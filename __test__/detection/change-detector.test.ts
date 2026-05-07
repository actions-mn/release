import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubReleaseChangeDetector } from '../../src/detection/change-detector.js';
import { computeContentHash } from '../../src/detection/content-hash.js';
import {
  DocumentId,
  DocumentStage,
  DocumentVersion,
  ReleaseTag,
  ContentHash
} from '../../src/domain/types.js';
import { DocumentType } from '../../src/domain/document-metadata.js';
import type { DocumentMetadata } from '../../src/domain/document-metadata.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';

function makeMetadata(outputDir: string): DocumentMetadata {
  return {
    id: DocumentId.fromRaw('CC 51015'),
    title: 'Test',
    version: DocumentVersion.from('1', DocumentStage.fromStatus('published')),
    doctype: 'standard',
    documentType: DocumentType.Standard,
    revdate: undefined,
    sourcePath: 'sources/cc-51015.adoc',
    outputDir,
    formats: ['html']
  };
}

function mockOctokit(releaseBody: string | null, status: number = 200) {
  return {
    rest: {
      repos: {
        getReleaseByTag: vi.fn().mockImplementation(() => {
          if (status === 404) {
            const err = new Error('Not Found');
            (err as any).status = 404;
            throw err;
          }
          if (status === 500) {
            const err = new Error('Server Error');
            (err as any).status = 500;
            throw err;
          }
          return { data: { body: releaseBody } };
        })
      }
    }
  } as any;
}

describe('GitHubReleaseChangeDetector', () => {
  const tmpDir = join(__dirname, 'tmp-detect-test');
  let tag: ReleaseTag;

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
    await writeFile(join(tmpDir, 'test.html'), 'content');
    const id = DocumentId.fromRaw('CC 51015');
    const version = DocumentVersion.from(
      '1',
      DocumentStage.fromStatus('published')
    );
    tag = ReleaseTag.from(id, version);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns changed when tag does not exist (404)', async () => {
    const detector = new GitHubReleaseChangeDetector(mockOctokit(null, 404), {
      owner: 'test',
      repo: 'test'
    });
    const metadata = makeMetadata(tmpDir);
    const result = await detector.detect(metadata, tag, false);
    expect(result.changed).toBe(true);
    expect(result.previousHash).toBeUndefined();
  });

  it('returns not changed when hashes match', async () => {
    const currentHash = await computeContentHash(tmpDir);
    const octokit = mockOctokit(
      `content-hash:${currentHash.toString()}\n\n## Title`
    );
    const detector = new GitHubReleaseChangeDetector(octokit, {
      owner: 'test',
      repo: 'test'
    });
    const metadata = makeMetadata(tmpDir);
    const result = await detector.detect(metadata, tag, false);
    expect(result.changed).toBe(false);
  });

  it('returns changed when hashes differ', async () => {
    const octokit = mockOctokit(
      `content-hash:0000000000000000000000000000000000000000000000000000000000000000\n\n## Title`
    );
    const detector = new GitHubReleaseChangeDetector(octokit, {
      owner: 'test',
      repo: 'test'
    });
    const metadata = makeMetadata(tmpDir);
    const result = await detector.detect(metadata, tag, false);
    expect(result.changed).toBe(true);
  });

  it('force mode always returns changed', async () => {
    const currentHash = await computeContentHash(tmpDir);
    const octokit = mockOctokit(
      `content-hash:${currentHash.toString()}\n\n## Title`
    );
    const detector = new GitHubReleaseChangeDetector(octokit, {
      owner: 'test',
      repo: 'test'
    });
    const metadata = makeMetadata(tmpDir);
    const result = await detector.detect(metadata, tag, true);
    expect(result.changed).toBe(true);
  });

  it('returns changed when release body has no hash', async () => {
    const octokit = mockOctokit('## Title\n\nSome body text');
    const detector = new GitHubReleaseChangeDetector(octokit, {
      owner: 'test',
      repo: 'test'
    });
    const metadata = makeMetadata(tmpDir);
    const result = await detector.detect(metadata, tag, false);
    expect(result.changed).toBe(true);
  });

  it('fails open on API error (500)', async () => {
    const detector = new GitHubReleaseChangeDetector(mockOctokit(null, 500), {
      owner: 'test',
      repo: 'test'
    });
    const metadata = makeMetadata(tmpDir);
    const result = await detector.detect(metadata, tag, false);
    expect(result.changed).toBe(true);
  });
});
