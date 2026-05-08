# 06: Change Detection

> **Status: COMPLETED** — Implemented and tested.

## Goal

Determine whether a document's compiled output has changed since its last release. This is the gate that prevents re-releasing unchanged documents.

## Strategy: Content Hash

Hash all files in the document's output directory (excluding any `.hash` metadata files). Compare against the hash stored in the previous GitHub Release's body.

### Why hash compiled output, not source

- Source-level diff misses transitive changes (included sections, images, dependencies)
- Source diff would need to track the entire include tree for each document
- Compiled output is the actual artifact — if it didn't change, there's nothing to release

## Implementation: `ContentHash`

```typescript
// src/detection/content-hash.ts
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

export class ContentHash {
  private constructor(private readonly value: string) {}

  static async fromDirectory(dirPath: string): Promise<ContentHash> {
    const files = await collectFiles(dirPath);
    files.sort(); // deterministic order

    const hasher = createHash('sha256');
    for (const file of files) {
      // Include relative path in hash for structural integrity
      const relative = file.slice(dirPath.length);
      hasher.update(relative);
      hasher.update('\0');

      // Stream file contents
      await new Promise<void>((resolve, reject) => {
        const stream = createReadStream(file);
        stream.on('data', (chunk: Buffer) => hasher.update(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      hasher.update('\0');
    }

    return new ContentHash(hasher.digest('hex'));
  }

  static fromString(hash: string): ContentHash {
    return new ContentHash(hash);
  }

  toString(): string { return this.value; }
  equals(other: ContentHash): boolean { return this.value === other.value; }
}
```

## Implementation: `ChangeDetector`

```typescript
// src/detection/change-detector.ts
export interface IChangeDetector {
  detect(
    metadata: DocumentMetadata,
    tag: ReleaseTag,
    force: boolean
  ): Promise<ChangeDetectorResult>;
}

export class GitHubReleaseChangeDetector implements IChangeDetector {
  constructor(private readonly octokit: Octokit, private readonly repo: { owner: string; repo: string }) {}

  async detect(
    metadata: DocumentMetadata,
    tag: ReleaseTag,
    force: boolean
  ): Promise<ChangeDetectorResult> {
    // 1. Compute current hash
    const currentHash = await ContentHash.fromDirectory(metadata.outputDir);

    // 2. Force mode — skip comparison
    if (force) {
      return { changed: true, currentHash, previousHash: undefined };
    }

    // 3. Check if release with this tag exists
    const previousHash = await this.fetchPreviousHash(tag);
    if (!previousHash) {
      // New release (tag doesn't exist) — always changed
      return { changed: true, currentHash, previousHash: undefined };
    }

    // 4. Compare hashes
    return {
      changed: !currentHash.equals(previousHash),
      currentHash,
      previousHash,
    };
  }

  private async fetchPreviousHash(tag: ReleaseTag): Promise<ContentHash | undefined> {
    try {
      const { data } = await this.octokit.rest.repos.getReleaseByTag({
        ...this.repo,
        tag: tag.toString(),
      });

      // Extract hash from release body: "content-hash:abc123..."
      const match = data.body?.match(/content-hash:([a-f0-9]+)/);
      if (match) return ContentHash.fromString(match[1]);
      return undefined;
    } catch (error) {
      // 404 = no previous release = changed
      if ((error as any).status === 404) return undefined;
      // Other errors — log warning, treat as changed (fail open)
      logger.warn(`Failed to fetch previous release for ${tag}: ${error}`);
      return undefined;
    }
  }
}
```

## Release Body Format

The content hash is embedded in the release body:

```markdown
content-hash:a1b2c3d4e5f6...

## CC 51015 Edition 1.0

| Field | Value |
|---|---|
| Title | JSCalendar |
| Status | Published |
| Edition | 1.0 |
| Doctype | standard |
| Revdate | 2019-01-18 |
| Formats | html, pdf, xml, rxl |
```

The first line is machine-readable (`content-hash:{sha256}`). The rest is human-readable metadata. This allows both programmatic comparison and human inspection.

## Edge Cases

| Scenario | Behavior |
|---|---|
| Tag doesn't exist | `changed: true` (new release) |
| Tag exists, same hash | `changed: false` (skip) |
| Tag exists, different hash | `changed: true` (update release) |
| Tag exists, no hash in body | `changed: true` (legacy release, force update) |
| API error (not 404) | `changed: true` (fail open) |
| `force: true` input | `changed: true` (skip comparison entirely) |
| Empty output directory | `changed: true` (edge case, hash of empty) |

## Performance

For large document sets (e.g., `csd-admin-documents` with 17 docs):
- Hash each document's output directory in parallel
- Each hash computation is I/O-bound, not CPU-bound
- SHA-256 of ~10MB (typical compiled output) takes <100ms

For the GitHub API calls:
- One `getReleaseByTag` per document
- Batch with `Promise.all` for parallelism
- Respect rate limits (authenticated: 5000/hr, more than enough)

## Tests

- `ContentHash.fromDirectory` with fixture files
- `ContentHash` equality
- `ContentHash` changes when a file changes
- `ContentHash` is deterministic (same files, same order, same hash)
- `GitHubReleaseChangeDetector` with mock octokit:
  - New tag → changed
  - Same hash → not changed
  - Different hash → changed
  - 404 → changed
  - `force: true` → always changed
  - Malformed body (no hash) → changed
