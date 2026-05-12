import type { ReleaseConfig } from './input-helper.js';
import type { DocumentMetadata } from './domain/document-metadata.js';
import {
  type IChangeDetector,
  type IArtifactPackager,
  type IReleasePublisher,
  type IDocumentExtractor,
  type IDocumentFilter,
  type ChangeDetectorResult,
  type ReleaseTag
} from './domain/types.js';
import type { NamingStrategyRegistry } from './packaging/naming-strategy.js';
import { logger } from './shared/logger.js';
import { mapWithConcurrency } from './shared/concurrency.js';

export interface PipelineResult {
  readonly released: DocumentMetadata[];
  readonly skipped: DocumentMetadata[];
  readonly failed: Array<{ document: DocumentMetadata; error: Error }>;
}

interface MutablePipelineResult {
  released: DocumentMetadata[];
  skipped: DocumentMetadata[];
  failed: Array<{ document: DocumentMetadata; error: Error }>;
}

export interface PipelineDependencies {
  extractor: IDocumentExtractor;
  filters: IDocumentFilter[];
  changeDetector: IChangeDetector;
  packager: IArtifactPackager;
  publisher: IReleasePublisher;
  namingRegistry: NamingStrategyRegistry;
}

export class ReleasePipeline {
  private readonly deps: PipelineDependencies;
  private readonly config: ReleaseConfig;

  constructor(config: ReleaseConfig, deps: PipelineDependencies) {
    this.config = config;
    this.deps = deps;
  }

  async execute(): Promise<PipelineResult> {
    const result: MutablePipelineResult = {
      released: [],
      skipped: [],
      failed: []
    };

    // 1. Discover
    logger.info('Discovering compiled documents...');
    const absoluteOutputDir = `${this.config.workspacePath}/${this.config.outputDir}`;
    const allDocs = await this.deps.extractor.discover(absoluteOutputDir);
    logger.info(`Found ${allDocs.length} documents`);

    if (allDocs.length === 0) {
      logger.info('No documents found — nothing to release.');
      return result;
    }

    // 2. Filter (visibility, pattern, etc.)
    let filteredDocs = allDocs;
    for (const filter of this.deps.filters) {
      filteredDocs = filter.filter(filteredDocs);
    }
    logger.info(`${filteredDocs.length} documents passed all filters`);

    if (filteredDocs.length === 0) {
      logger.info('No documents matched filters — nothing to release.');
      return result;
    }

    // 3. Two-phase parallel processing
    const concurrency = this.config.concurrency ?? 4;

    // Phase 1: Change detection (parallel, read-only)
    const detectionResults = await mapWithConcurrency(
      filteredDocs,
      concurrency,
      async (doc) => {
        const strategy = this.deps.namingRegistry.resolve(doc.documentType);
        const tag = strategy.computeTag(doc.id, doc.version);
        const canonicalBase = strategy.computeCanonicalBase(
          doc.id,
          doc.version
        );
        const detection = await this.deps.changeDetector.detect(
          doc,
          tag,
          this.config.force
        );
        return { doc, tag, canonicalBase, detection };
      }
    );

    // Collect detection results into released/skipped/failed
    const changed: Array<{
      doc: DocumentMetadata;
      tag: ReleaseTag;
      canonicalBase: string;
      detection: ChangeDetectorResult;
    }> = [];

    for (const r of detectionResults) {
      if (r.status === 'rejected') {
        const doc = filteredDocs[detectionResults.indexOf(r)];
        result.failed.push({
          document: doc,
          error:
            r.reason instanceof Error ? r.reason : new Error(String(r.reason))
        });
        logger.error(`FAILED: ${doc.id}: ${r.reason}`);
        continue;
      }
      const { doc, detection } = r.value;
      if (!detection.changed) {
        result.skipped.push(doc);
        logger.info(`SKIPPED: ${doc.id} (unchanged)`);
      } else {
        changed.push(r.value);
      }
    }

    // Phase 2: Package + publish changed documents (parallel)
    if (changed.length > 0) {
      const publishResults = await mapWithConcurrency(
        changed,
        concurrency,
        async ({ doc, tag, canonicalBase, detection }) => {
          const artifact = await this.deps.packager.package(doc, canonicalBase);
          await this.deps.publisher.publish(
            tag,
            artifact.zipPath,
            detection.currentHash,
            doc,
            tag.isPreRelease,
            artifact
          );
          return doc;
        }
      );

      for (const r of publishResults) {
        const idx = publishResults.indexOf(r);
        if (r.status === 'fulfilled') {
          result.released.push(r.value);
          logger.info(
            `RELEASED: ${r.value.id} (${r.value.version.tagComponent})`
          );
        } else {
          result.failed.push({
            document: changed[idx].doc,
            error:
              r.reason instanceof Error ? r.reason : new Error(String(r.reason))
          });
          logger.error(`FAILED: ${changed[idx].doc.id}: ${r.reason}`);
        }
      }
    }

    // 4. Summary
    logger.info(
      `Done. Released: ${result.released.length}, ` +
        `Skipped: ${result.skipped.length}, ` +
        `Failed: ${result.failed.length}`
    );

    return result;
  }
}
