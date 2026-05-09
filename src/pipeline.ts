import type { ReleaseConfig } from './input-helper.js';
import type { DocumentMetadata } from './domain/document-metadata.js';
import {
  type IChangeDetector,
  type IArtifactPackager,
  type IReleasePublisher,
  type IDocumentExtractor,
  type IDocumentFilter
} from './domain/types.js';
import type { NamingStrategyRegistry } from './packaging/naming-strategy.js';
import { logger } from './shared/logger.js';

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

    // 3. Process each document (parallel with allSettled)
    const settled = await Promise.allSettled(
      filteredDocs.map((doc) => this.processDocument(doc))
    );

    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i];
      const doc = filteredDocs[i];

      if (outcome.status === 'fulfilled') {
        if (outcome.value.released) {
          result.released.push(doc);
          logger.info(`RELEASED: ${doc.id} (${doc.version.tagComponent})`);
        } else {
          result.skipped.push(doc);
          logger.info(`SKIPPED: ${doc.id} (unchanged)`);
        }
      } else {
        result.failed.push({
          document: doc,
          error: outcome.reason
        });
        logger.error(`FAILED: ${doc.id}: ${outcome.reason}`);
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

  private async processDocument(
    metadata: DocumentMetadata
  ): Promise<{ released: boolean }> {
    const strategy = this.deps.namingRegistry.resolve(metadata.documentType);
    const tag = strategy.computeTag(metadata.id, metadata.version);

    const detection = await this.deps.changeDetector.detect(
      metadata,
      tag,
      this.config.force
    );

    if (!detection.changed) {
      return { released: false };
    }

    const artifact = await this.deps.packager.package(
      metadata,
      metadata.version
    );

    await this.deps.publisher.publish(
      tag,
      artifact.zipPath,
      detection.currentHash,
      metadata,
      tag.isPreRelease
    );

    return { released: true };
  }
}
