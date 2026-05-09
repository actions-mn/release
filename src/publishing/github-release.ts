import { stat } from 'fs/promises';
import { createReadStream } from 'fs';
import { basename } from 'path';
import {
  type IReleasePublisher,
  type PublishResult,
  type ReleaseTag,
  type ContentHash,
  type GitHubReleasesApi,
  type GitHubReleaseData
} from '../domain/types.js';
import type { DocumentMetadata } from '../domain/document-metadata.js';
import { logger } from '../shared/logger.js';

export class GitHubReleasePublisher implements IReleasePublisher {
  private readonly octokit: GitHubReleasesApi;
  constructor(
    octokit: GitHubReleasesApi,
    private readonly repo: { owner: string; repo: string }
  ) {
    this.octokit = octokit;
  }

  async publish(
    tag: ReleaseTag,
    assetPath: string,
    hash: ContentHash,
    metadata: DocumentMetadata,
    preRelease: boolean
  ): Promise<PublishResult> {
    const tagName = tag.toString();
    const body = this.formatBody(hash, metadata);

    const existing = await this.findExistingRelease(tagName);

    if (existing) {
      if (!tag.isPreRelease && !existing.prerelease) {
        logger.warn(
          `Published release ${tagName} already exists — skipping update. ` +
            `Bump the edition to create a new release.`
        );
        return {
          tag,
          url: existing.html_url,
          created: false
        };
      }

      return this.updateRelease(existing, tag, assetPath, body, preRelease);
    }

    return this.createRelease(tag, assetPath, body, preRelease, metadata);
  }

  private async findExistingRelease(
    tag: string
  ): Promise<GitHubReleaseData | undefined> {
    try {
      const { data } = await this.octokit.rest.repos.getReleaseByTag({
        ...this.repo,
        tag
      });
      return data;
    } catch (error) {
      if ((error as { status?: number }).status === 404) return undefined;
      throw error;
    }
  }

  private async createRelease(
    tag: ReleaseTag,
    assetPath: string,
    body: string,
    preRelease: boolean,
    metadata: DocumentMetadata
  ): Promise<PublishResult> {
    const { data } = await this.octokit.rest.repos.createRelease({
      ...this.repo,
      tag_name: tag.toString(),
      name: `${metadata.id} ${metadata.version.tagComponent}`,
      body,
      prerelease: preRelease,
      draft: false
    });

    await this.uploadAsset(data.id, assetPath);

    return {
      tag,
      url: data.html_url,
      created: true
    };
  }

  private async updateRelease(
    existing: GitHubReleaseData,
    tag: ReleaseTag,
    assetPath: string,
    body: string,
    preRelease: boolean
  ): Promise<PublishResult> {
    await this.octokit.rest.repos.updateRelease({
      ...this.repo,
      release_id: existing.id,
      body,
      prerelease: preRelease
    });

    for (const asset of existing.assets) {
      await this.octokit.rest.repos.deleteReleaseAsset({
        ...this.repo,
        asset_id: asset.id
      });
    }

    await this.uploadAsset(existing.id, assetPath);

    return {
      tag,
      url: existing.html_url,
      created: false
    };
  }

  private async uploadAsset(
    releaseId: number,
    assetPath: string
  ): Promise<void> {
    const fileStat = await stat(assetPath);
    const fileName = basename(assetPath);
    const fileStream = createReadStream(assetPath);

    await this.octokit.rest.repos.uploadReleaseAsset({
      ...this.repo,
      release_id: releaseId,
      name: fileName,
      data: fileStream as unknown as string,
      headers: {
        'content-length': fileStat.size,
        'content-type': 'application/zip'
      }
    });
  }

  private formatBody(hash: ContentHash, metadata: DocumentMetadata): string {
    const lines = [
      `content-hash:${hash.toString()}`,
      '',
      `## ${metadata.title || metadata.id.toString()}`,
      '',
      '| Field | Value |',
      '|---|---|',
      `| Document | ${metadata.id.toString()} |`,
      `| Edition | ${metadata.version.editionNumber} |`,
      `| Status | ${metadata.version.tagComponent} |`,
      `| Doctype | ${metadata.doctype} |`,
      `| Revdate | ${metadata.revdate ?? 'N/A'} |`,
      `| Formats | ${metadata.formats.join(', ')} |`
    ];
    return lines.join('\n');
  }
}
