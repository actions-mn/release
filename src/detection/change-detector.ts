import {
  ContentHash,
  type ChangeDetectorResult,
  type IChangeDetector,
  type ReleaseTag,
  type GitHubReleasesApi
} from '../domain/types.js';
import type { DocumentMetadata } from '../domain/document-metadata.js';
import { computeContentHash } from './content-hash.js';
import { logger } from '../shared/logger.js';

export class GitHubReleaseChangeDetector implements IChangeDetector {
  private readonly octokit: GitHubReleasesApi;
  constructor(
    octokit: GitHubReleasesApi,
    private readonly repo: { owner: string; repo: string }
  ) {
    this.octokit = octokit;
  }

  async detect(
    metadata: DocumentMetadata,
    tag: ReleaseTag,
    force: boolean
  ): Promise<ChangeDetectorResult> {
    const currentHash = await computeContentHash(metadata.outputDir);

    if (force) {
      return { changed: true, currentHash, previousHash: undefined };
    }

    const previousHash = await this.fetchPreviousHash(tag);
    if (!previousHash) {
      return { changed: true, currentHash, previousHash: undefined };
    }

    return {
      changed: !currentHash.equals(previousHash),
      currentHash,
      previousHash
    };
  }

  private async fetchPreviousHash(
    tag: ReleaseTag
  ): Promise<ContentHash | undefined> {
    try {
      const { data } = await this.octokit.rest.repos.getReleaseByTag({
        ...this.repo,
        tag: tag.toString()
      });

      const match = data.body?.match(/content-hash:([a-f0-9]+)/);
      if (match) return ContentHash.fromString(match[1]);
      return undefined;
    } catch (error) {
      if ((error as { status?: number }).status === 404) return undefined;
      logger.warn(`Failed to fetch previous release for ${tag}: ${error}`);
      return undefined;
    }
  }
}
