# 09: Orchestration & Main Pipeline

> **Status: COMPLETED** — Implemented and tested.

## Goal

Wire all components together: input parsing → compilation → discovery → filtering → detection → packaging → publishing. The main entry point and the pipeline orchestrator.

## Source: `src/main.ts`

```typescript
import { setFailed, setOutput, info } from '@actions/core';
import { getInputs } from './input-helper.js';
import { ReleasePipeline } from './pipeline.js';

async function run(): Promise<void> {
  try {
    const config = await getInputs();
    const pipeline = new ReleasePipeline(config);
    const result = await pipeline.execute();
    setOutputs(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setFailed(`Release failed: ${message}`);
  }
}

run();
```

## Source: `src/input-helper.ts`

Follows `site-gen/input-helper.ts` patterns exactly:

```typescript
export interface ReleaseConfig {
  // Paths
  sourcePath: string;
  outputDir: string;
  configFile: string;
  releaseConfigFile: string;
  workspacePath: string;

  // Compilation flags (passed through to site-gen logic)
  agreeToTerms: boolean;
  installFonts: boolean;
  continueWithoutFonts: boolean;
  useBundler: boolean;

  // Release-specific
  force: boolean;
  includePattern: string;
  token: string;

  // GitHub context
  repo: { owner: string; repo: string };
}

export async function getInputs(): Promise<ReleaseConfig> {
  // Read from action.yml inputs using @actions/core getInput
  // Validate paths (reuse validatePath from site-gen)
  // Extract repo from GITHUB_REPOSITORY env var
}
```

## Source: `src/pipeline.ts`

The orchestrator. Composes all components using dependency injection:

```typescript
export interface PipelineResult {
  readonly released: DocumentMetadata[];
  readonly skipped: DocumentMetadata[];
  readonly failed: Array<{ document: DocumentMetadata; error: Error }>;
}

export class ReleasePipeline {
  private readonly compiler: MetanormaCompiler;
  private readonly extractor: IDocumentExtractor;
  private readonly manifestLoader: ManifestLoader;
  private readonly visibilityFilter: IVisibilityFilter;
  private readonly changeDetector: IChangeDetector;
  private readonly packager: IArtifactPackager;
  private readonly publisher: IReleasePublisher;

  constructor(config: ReleaseConfig) {
    const octokit = new Octokit({ auth: config.token });

    this.compiler = new MetanormaCompiler(config);
    this.extractor = new RxlExtractor();
    this.manifestLoader = new ManifestLoader();
    this.visibilityFilter = new VisibilityFilter();
    this.changeDetector = new GitHubReleaseChangeDetector(octokit, config.repo);
    this.packager = new ZipPackager();
    this.publisher = new GitHubReleasePublisher(config.token, config.repo);
  }

  async execute(): Promise<PipelineResult> {
    const result: PipelineResult = { released: [], skipped: [], failed: [] };

    // 1. Compile
    logger.info('Compiling documents...');
    await this.compiler.compile();

    // 2. Discover
    logger.info('Discovering compiled documents...');
    const allDocs = await discoverDocuments(this.config.outputDir, this.extractor);
    logger.info(`Found ${allDocs.length} documents`);

    // 3. Filter by visibility
    const manifest = await this.manifestLoader.load(
      this.config.sourcePath,
      this.config.releaseConfigFile
    );
    const visibleDocs = this.visibilityFilter.filter(allDocs, manifest);
    logger.info(`${visibleDocs.length} documents passed visibility filter`);

    // 4. Filter by pattern
    const patternFilter = new PatternFilter(this.config.includePattern);
    const targetDocs = patternFilter.filter(visibleDocs);
    logger.info(`${targetDocs.length} documents matched include pattern`);

    // 5. Process each document
    const settled = await Promise.allSettled(
      targetDocs.map(doc => this.processDocument(doc))
    );

    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i];
      const doc = targetDocs[i];

      if (outcome.status === 'fulfilled') {
        if (outcome.value.released) {
          result.released.push(doc);
          logger.info(`RELEASED: ${doc.id} (${doc.version.tagComponent})`);
        } else {
          result.skipped.push(doc);
          logger.info(`SKIPPED: ${doc.id} (unchanged)`);
        }
      } else {
        result.failed.push({ document: doc, error: outcome.reason });
        logger.error(`FAILED: ${doc.id}: ${outcome.reason}`);
      }
    }

    // 6. Summary
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
    const tag = TagBuilder.build(metadata);

    // Change detection
    const detection = await this.changeDetector.detect(
      metadata, tag, this.config.force
    );

    if (!detection.changed) {
      return { released: false };
    }

    // Package
    const artifact = await this.packager.package(metadata, metadata.version);

    // Publish
    await this.publisher.publish(
      tag,
      artifact.zipPath,
      detection.currentHash,
      metadata,
      tag.isPreRelease
    );

    return { released: true };
  }
}
```

## Source: `src/compilation/metanorma-compiler.ts`

Delegates compilation to metanorma. Reuses `site-gen`'s command-building logic but doesn't depend on the action directly — copies the command construction pattern.

```typescript
export class MetanormaCompiler {
  constructor(private readonly config: ReleaseConfig) {}

  async compile(): Promise<void> {
    // Build command: metanorma site generate -c metanorma.yml -o _site [flags]
    // Execute via @actions/exec
    // Same flag logic as site-gen's MetanormaCommandManager
  }
}
```

## Output

```typescript
function setOutputs(result: PipelineResult): void {
  setOutput('released-documents', JSON.stringify(result.released.map(d => d.id.toString())));
  setOutput('skipped-documents', JSON.stringify(result.skipped.map(d => d.id.toString())));
  setOutput('total-documents', result.released.length + result.skipped.length + result.failed.length);
}
```

## Logger

```typescript
// src/shared/logger.ts
export const logger = {
  info: (msg: string) => core.info(`[mn-release] ${msg}`),
  warn: (msg: string) => core.warning(`[mn-release] ${msg}`),
  error: (msg: string) => core.error(`[mn-release] ${msg}`),
};
```

## Tests

- `ReleasePipeline` with all mocks:
  - All documents unchanged → all skipped
  - One document changed → one released, rest skipped
  - New document (no previous release) → released
  - Private document → filtered out
  - Pattern filter excludes some → not processed
  - One document fails packaging → others continue
- `getInputs` validation
- `setOutputs` format
- `MetanormaCompiler` command construction (reuse site-gen test patterns)
