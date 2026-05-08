# 08: Release Publishing

> **Status: COMPLETED** — Implemented and tested.

## Goal

Create or update per-document GitHub Releases with the packaged zip and metadata.

## Implementation: `GitHubReleasePublisher`

```typescript
// src/publishing/github-release.ts
import { Octokit } from '@actions/github';

export class GitHubReleasePublisher implements IReleasePublisher {
  private readonly octokit: Octokit;

  constructor(
    token: string,
    private readonly repo: { owner: string; repo: string }
  ) {
    this.octokit = new Octokit({ auth: token });
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

    // Try to get existing release by tag
    const existing = await this.findExistingRelease(tagName);

    if (existing) {
      // Update existing release (draft iteration)
      return this.updateRelease(existing, assetPath, body, preRelease);
    } else {
      // Create new release
      return this.createRelease(tagName, assetPath, body, preRelease, metadata);
    }
  }

  private async findExistingRelease(tag: string): Promise<Release | undefined> {
    try {
      const { data } = await this.octokit.rest.repos.getReleaseByTag({
        ...this.repo,
        tag,
      });
      return data;
    } catch (error) {
      if ((error as any).status === 404) return undefined;
      throw error;
    }
  }

  private async createRelease(
    tag: string,
    assetPath: string,
    body: string,
    preRelease: boolean,
    metadata: DocumentMetadata
  ): Promise<PublishResult> {
    const { data } = await this.octokit.rest.repos.createRelease({
      ...this.repo,
      tag_name: tag,
      name: `${metadata.id} ${metadata.version.tagComponent}`,
      body,
      prerelease: preRelease,
      draft: false,
    });

    // Upload asset
    await this.uploadAsset(data.id, assetPath);

    return {
      tag,
      url: data.html_url,
      created: true,
    };
  }

  private async updateRelease(
    existing: Release,
    assetPath: string,
    body: string,
    preRelease: boolean
  ): Promise<PublishResult> {
    // Update body (with new hash)
    await this.octokit.rest.repos.updateRelease({
      ...this.repo,
      release_id: existing.id,
      body,
      prerelease: preRelease,
    });

    // Delete old asset if exists
    if (existing.assets.length > 0) {
      for (const asset of existing.assets) {
        await this.octokit.rest.repos.deleteReleaseAsset({
          ...this.repo,
          asset_id: asset.id,
        });
      }
    }

    // Upload new asset
    await this.uploadAsset(existing.id, assetPath);

    return {
      tag: existing.tag_name,
      url: existing.html_url,
      created: false,
    };
  }

  private async uploadAsset(
    releaseId: number,
    assetPath: string
  ): Promise<void> {
    const stat = await fs.stat(assetPath);
    const fileName = path.basename(assetPath);
    const fileStream = createReadStream(assetPath);

    await this.octokit.rest.repos.uploadReleaseAsset({
      ...this.repo,
      release_id: releaseId,
      name: fileName,
      data: fileStream as any,
      headers: {
        'content-length': stat.size,
        'content-type': 'application/zip',
      },
    });
  }
}
```

## Release Body Format

```markdown
content-hash:{sha256hex}

## {title}

| Field | Value |
|---|---|
| Document | {docidentifier} |
| Edition | {edition} |
| Status | {stage} |
| Doctype | {doctype} |
| Revdate | {revdate} |
| Formats | {comma-separated formats} |
```

The first line (`content-hash:...`) is machine-consumed by `ChangeDetector`. The rest is human-readable in the GitHub UI.

## Immutability Rules

```typescript
private shouldUpdate(tag: ReleaseTag, existing: Release): boolean {
  // Published releases are immutable — never overwrite
  if (!tag.isPreRelease && existing && !existing.prerelease) {
    logger.warn(
      `Published release ${tag} already exists — skipping update. ` +
      `Bump the edition to create a new release.`
    );
    return false;
  }
  return true;
}
```

| Previous release | Current state | Action |
|---|---|---|
| Published (stable) | Still published, same hash | Skip (unchanged) |
| Published (stable) | Still published, different hash | **Skip** (immutable — require edition bump) |
| Draft (pre-release) | Still draft, same hash | Skip (unchanged) |
| Draft (pre-release) | Still draft, different hash | Update in-place |
| No previous | Any | Create new |
| Draft | Published (stage changed) | Create new tag (e.g. `ed1.0-cd` → `ed1.0`) |

## Error Handling

- Tag creation failure → log, continue with other documents
- Asset upload failure → retry once, then fail that document (don't block others)
- API rate limiting → use exponential backoff (Octokit has built-in throttling plugin)
- Permission denied → fail early with clear message about required `contents: write` permission

## Performance

- Create releases in parallel (up to 5 concurrent — respect API limits)
- Use `Promise.allSettled` to not block on individual failures
- Total API calls per document: 2 (getReleaseByTag + createRelease) or 4 (getReleaseByTag + updateRelease + deleteAsset + uploadAsset)

## Tests

- Create new release (tag doesn't exist)
- Update existing draft release
- Skip immutable published release
- Upload zip asset
- Replace existing asset on update
- Release body contains content-hash and metadata
- Handle 404 gracefully (new release)
- Handle API errors (retry, fail document, continue others)
- Pre-release flag set correctly for drafts vs published
- Parallel release creation
