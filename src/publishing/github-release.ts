import { stat } from 'fs/promises';
import { createReadStream } from 'fs';
import { basename } from 'path';
import {
  type IReleasePublisher,
  type PublishResult,
  type ReleaseTag,
  type ContentHash,
  type GitHubReleasesApi,
  type GitHubReleaseData,
  type ArtifactResult
} from '../domain/types.js';
import type { DocumentMetadata } from '../domain/document-metadata.js';
import { ReleaseMetadata } from '../domain/release-metadata.js';
import { Channel } from '../domain/channel.js';
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
    preRelease: boolean,
    artifact?: ArtifactResult,
    channels: Channel[] = [Channel.public('default')]
  ): Promise<PublishResult> {
    const tagName = tag.toString();
    const body = this.formatBody(hash, metadata, channels);

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

      return this.updateRelease(
        existing,
        tag,
        assetPath,
        body,
        preRelease,
        artifact
      );
    }

    return this.createRelease(
      tag,
      assetPath,
      body,
      preRelease,
      metadata,
      artifact
    );
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
    metadata: DocumentMetadata,
    artifact?: ArtifactResult
  ): Promise<PublishResult> {
    const { data } = await this.octokit.rest.repos.createRelease({
      ...this.repo,
      tag_name: tag.toString(),
      name: `${metadata.id} ${metadata.version.tagComponent}`,
      body,
      prerelease: preRelease,
      draft: false
    });

    await this.uploadAsset(data.id, assetPath, artifact?.assetName);

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
    preRelease: boolean,
    artifact?: ArtifactResult
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

    await this.uploadAsset(existing.id, assetPath, artifact?.assetName);

    return {
      tag,
      url: existing.html_url,
      created: false
    };
  }

  private async uploadAsset(
    releaseId: number,
    assetPath: string,
    assetName?: string
  ): Promise<void> {
    const fileStat = await stat(assetPath);
    const name = assetName ?? basename(assetPath).replace(/^mn-release-/, '');
    const fileStream = createReadStream(assetPath);

    await this.octokit.rest.repos.uploadReleaseAsset({
      ...this.repo,
      release_id: releaseId,
      name,
      data: fileStream as unknown as string,
      headers: {
        'content-length': fileStat.size,
        'content-type': 'application/zip'
      }
    });
  }

  private formatBody(
    hash: ContentHash,
    metadata: DocumentMetadata,
    channels: Channel[]
  ): string {
    const releaseMeta = ReleaseMetadata.fromDocument(metadata, channels);

    const channelStr =
      channels.length > 0
        ? channels.map((c) => c.toString()).join(', ')
        : 'N/A';

    return [
      `content-hash:${hash.toString()}`,
      '',
      '<!-- mn-release-metadata',
      releaseMeta.toString(),
      '-->',
      '',
      `## ${metadata.title || metadata.id.toString()}`,
      '',
      '| Field | Value |',
      '|---|---|',
      `| Document | ${metadata.id.toString()} |`,
      `| Edition | ${metadata.version.editionNumber} |`,
      `| Status | ${metadata.version.stage.toString()} |`,
      `| Doctype | ${metadata.doctype} |`,
      `| Channels | ${channelStr} |`,
      `| Revdate | ${metadata.revdate ?? 'N/A'} |`,
      `| Formats | ${metadata.formats.join(', ')} |`
    ].join('\n');
  }
}
