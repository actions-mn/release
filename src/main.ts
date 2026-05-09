import { setFailed, setOutput } from '@actions/core';
import { getOctokit } from '@actions/github';
import { getInputs } from './input-helper.js';
import { ReleasePipeline } from './pipeline.js';
import { RxlExtractor } from './extractors/rxl-extractor.js';
import { VisibilityFilter } from './filters/visibility-filter.js';
import { PatternFilter } from './filters/pattern-filter.js';
import { loadManifest } from './filters/manifest-loader.js';
import { GitHubReleaseChangeDetector } from './detection/change-detector.js';
import { ZipPackager } from './packaging/zip-packager.js';
import { GitHubReleasePublisher } from './publishing/github-release.js';
import { createDefaultRegistry } from './packaging/naming-strategy.js';
import type { GitHubReleasesApi } from './domain/types.js';

async function run(): Promise<void> {
  try {
    const config = await getInputs();

    const octokit = getOctokit(config.token) as unknown as GitHubReleasesApi;
    const namingRegistry = createDefaultRegistry();

    const manifest = await loadManifest(
      config.workspacePath,
      config.releaseConfigFile
    );

    const pipeline = new ReleasePipeline(config, {
      extractor: new RxlExtractor(),
      filters: [
        new VisibilityFilter(manifest),
        new PatternFilter(config.includePattern)
      ],
      changeDetector: new GitHubReleaseChangeDetector(octokit, config.repo),
      packager: new ZipPackager(namingRegistry),
      publisher: new GitHubReleasePublisher(octokit, config.repo),
      namingRegistry
    });

    const result = await pipeline.execute();

    setOutput(
      'released-documents',
      JSON.stringify(result.released.map((d) => d.id.toString()))
    );
    setOutput(
      'skipped-documents',
      JSON.stringify(result.skipped.map((d) => d.id.toString()))
    );
    setOutput(
      'total-documents',
      result.released.length + result.skipped.length + result.failed.length
    );

    if (result.failed.length > 0) {
      const failedIds = result.failed
        .map((f) => f.document.id.toString())
        .join(', ');
      setFailed(`${result.failed.length} document(s) failed: ${failedIds}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setFailed(`Release failed: ${message}`);
  }
}

run();
