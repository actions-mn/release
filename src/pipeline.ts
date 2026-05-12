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
import type { ChannelManifest } from './domain/channel-manifest.js';
import { Channel } from './domain/channel.js';
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
  manifest?: ChannelManifest;
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

    // Collect detection results into changed/skipped/failed
    const changed: Array<{
      doc: DocumentMetadata;
      tag: ReleaseTag;
      canonicalBase: string;
      detection: ChangeDetectorResult;
      channels: Channel[];
    }> = [];

    for (let i = 0; i < detectionResults.length; i++) {
      const r = detectionResults[i];
      if (r.status === 'rejected') {
        result.failed.push({
          document: filteredDocs[i],
          error:
            r.reason instanceof Error ? r.reason : new Error(String(r.reason))
        });
        logger.error(`FAILED: ${filteredDocs[i].id}: ${r.reason}`);
        continue;
      }
      const { doc, detection } = r.value;

      // Resolve per-document policy for stage constraints and channels
      const channels = this.resolveChannels(doc);

      if (!detection.changed) {
        result.skipped.push(doc);
        logger.info(`SKIPPED: ${doc.id} (unchanged)`);
      } else if (!this.passesStageConstraint(doc)) {
        result.skipped.push(doc);
        logger.info(
          `SKIPPED: ${doc.id} (stage ${doc.version.stage.toString()} not in manifest allow list)`
        );
      } else {
        changed.push({ ...r.value, channels });
      }
    }

    // Phase 2: Package + publish changed documents (parallel)
    if (changed.length > 0) {
      const publishResults = await mapWithConcurrency(
        changed,
        concurrency,
        async ({ doc, tag, canonicalBase, detection, channels }) => {
          const artifact = await this.deps.packager.package(doc, canonicalBase);
          await this.deps.publisher.publish(
            tag,
            artifact.zipPath,
            detection.currentHash,
            doc,
            tag.isPreRelease,
            artifact,
            channels
          );
          return doc;
        }
      );

      for (let i = 0; i < publishResults.length; i++) {
        const r = publishResults[i];
        if (r.status === 'fulfilled') {
          result.released.push(r.value);
          logger.info(
            `RELEASED: ${r.value.id} (${r.value.version.tagComponent})`
          );
        } else {
          result.failed.push({
            document: changed[i].doc,
            error:
              r.reason instanceof Error ? r.reason : new Error(String(r.reason))
          });
          logger.error(`FAILED: ${changed[i].doc.id}: ${r.reason}`);
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

  private resolveChannels(doc: DocumentMetadata): Channel[] {
    if (this.deps.manifest) {
      const policy = this.deps.manifest.resolve(doc);
      if (policy.channels.length > 0) return [...policy.channels];
    }
    return [Channel.public('default')];
  }

  private passesStageConstraint(doc: DocumentMetadata): boolean {
    if (!this.deps.manifest) return true;
    const policy = this.deps.manifest.resolve(doc);
    if (!policy.stageAllowList) return true;
    return policy.stageAllowList.has(doc.version.stage.toString());
  }
}
