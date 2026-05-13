import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubReleasePublisher } from '../../src/publishing/github-release.js';
import {
  ReleaseTag,
  ContentHash,
  DocumentId,
  DocumentVersion,
  DocumentStage
} from '../../src/domain/types.js';
import { DocumentType } from '../../src/domain/document-metadata.js';
import type { DocumentMetadata } from '../../src/domain/document-metadata.js';
import { Channel } from '../../src/domain/channel.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';

function makeDoc(overrides: Partial<DocumentMetadata> = {}): DocumentMetadata {
  return {
    id: DocumentId.fromRaw('cc-51015'),
    title: 'Test Document',
    version: DocumentVersion.from('1', DocumentStage.fromStatus('published')),
    doctype: 'standard',
    documentType: DocumentType.Standard,
    flavor: undefined,
    revdate: undefined,
    sourcePath: 'sources/cc-51015.adoc',
    outputDir: '',
    formats: ['html'],
    fileBaseName: 'cc-51015',
    ...overrides
  };
}

function mockOctokit(responses: Record<string, unknown>) {
  return {
    rest: {
      repos: {
        getReleaseByTag: vi
          .fn()
          .mockImplementation((params: { tag: string }) => {
            const key = `getReleaseByTag:${params.tag}`;
            if (key in responses) {
              const resp = responses[key];
              if (resp instanceof Error) throw resp;
              return resp;
            }
            const err = new Error('Not found');
            (err as { status?: number }).status = 404;
            throw err;
          }),
        createRelease: vi.fn().mockResolvedValue(
          responses['createRelease'] ?? {
            data: {
              id: 1,
              tag_name: 'tag',
              html_url: 'https://github.com/test/test/releases/tag/tag',
              prerelease: false
            }
          }
        ),
        updateRelease: vi
          .fn()
          .mockResolvedValue(responses['updateRelease'] ?? { data: { id: 1 } }),
        deleteRelease: vi.fn().mockResolvedValue({}),
        deleteReleaseAsset: vi.fn().mockResolvedValue({}),
        uploadReleaseAsset: vi.fn().mockResolvedValue({ data: {} })
      },
      git: {
        deleteRef: vi.fn().mockResolvedValue({})
      }
    }
  };
}

describe('GitHubReleasePublisher', () => {
  let tmpDir: string;
  let assetPath: string;

  beforeEach(async () => {
    tmpDir = join(__dirname, 'tmp-release-test');
    await mkdir(tmpDir, { recursive: true });
    assetPath = join(tmpDir, 'test-asset.zip');
    await writeFile(assetPath, 'fake zip content');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('creates a new release when none exists', async () => {
    const octokit = mockOctokit({
      createRelease: {
        data: {
          id: 42,
          tag_name: 'cc-51015/ed1',
          html_url: 'https://github.com/o/r/releases/tag/cc-51015/ed1',
          prerelease: false
        }
      }
    });

    const publisher = new GitHubReleasePublisher(octokit, {
      owner: 'o',
      repo: 'r'
    });
    const tag = ReleaseTag.from(
      DocumentId.fromRaw('cc-51015'),
      DocumentVersion.from('1', DocumentStage.fromStatus('published'))
    );
    const hash = ContentHash.fromString('abc123');
    const doc = makeDoc();

    const result = await publisher.publish(tag, assetPath, hash, doc, false);

    expect(result.created).toBe(true);
    expect(result.tag.toString()).toBe('cc-51015/ed1');
    expect(result.url).toContain('cc-51015/ed1');
    expect(octokit.rest.repos.createRelease).toHaveBeenCalledOnce();
    expect(octokit.rest.repos.uploadReleaseAsset).toHaveBeenCalledOnce();
  });

  it('skips update when published release already exists', async () => {
    const octokit = mockOctokit({
      'getReleaseByTag:cc-51015/ed1': {
        data: {
          id: 10,
          tag_name: 'cc-51015/ed1',
          html_url: 'https://github.com/o/r/releases/tag/cc-51015/ed1',
          prerelease: false,
          body: 'content-hash:old',
          assets: []
        }
      }
    });

    const publisher = new GitHubReleasePublisher(octokit, {
      owner: 'o',
      repo: 'r'
    });
    const tag = ReleaseTag.from(
      DocumentId.fromRaw('cc-51015'),
      DocumentVersion.from('1', DocumentStage.fromStatus('published'))
    );
    const hash = ContentHash.fromString('abc123');
    const doc = makeDoc();

    const result = await publisher.publish(tag, assetPath, hash, doc, false);

    expect(result.created).toBe(false);
    expect(result.tag.toString()).toBe('cc-51015/ed1');
    expect(octokit.rest.repos.createRelease).not.toHaveBeenCalled();
    expect(octokit.rest.repos.updateRelease).not.toHaveBeenCalled();
  });

  it('updates existing prerelease when tag matches', async () => {
    const octokit = mockOctokit({
      'getReleaseByTag:cc-51015/ed2-wd': {
        data: {
          id: 20,
          tag_name: 'cc-51015/ed2-wd',
          html_url: 'https://github.com/o/r/releases/tag/cc-51015/ed2-wd',
          prerelease: true,
          body: 'content-hash:old',
          assets: [{ id: 100, name: 'old.zip' }]
        }
      }
    });

    const publisher = new GitHubReleasePublisher(octokit, {
      owner: 'o',
      repo: 'r'
    });
    const tag = ReleaseTag.from(
      DocumentId.fromRaw('cc-51015'),
      DocumentVersion.from('2', DocumentStage.fromStatus('working-draft'))
    );
    const hash = ContentHash.fromString('newhash');
    const doc = makeDoc({
      version: DocumentVersion.from(
        '2',
        DocumentStage.fromStatus('working-draft')
      )
    });

    const result = await publisher.publish(tag, assetPath, hash, doc, true);

    expect(result.created).toBe(false);
    expect(octokit.rest.repos.updateRelease).toHaveBeenCalledOnce();
    expect(octokit.rest.repos.deleteReleaseAsset).toHaveBeenCalledWith(
      expect.objectContaining({ asset_id: 100 })
    );
    expect(octokit.rest.repos.uploadReleaseAsset).toHaveBeenCalledOnce();
  });

  it('includes content hash in release body', async () => {
    let capturedBody: string = '';
    const octokit = mockOctokit({
      createRelease: {
        data: {
          id: 42,
          tag_name: 'cc-51015/ed1',
          html_url: 'https://github.com/o/r/releases/tag/cc-51015/ed1',
          prerelease: false
        }
      }
    });
    octokit.rest.repos.createRelease.mockImplementation(
      (params: { body?: string }) => {
        capturedBody = params.body ?? '';
        return Promise.resolve({
          data: {
            id: 42,
            tag_name: 'cc-51015/ed1',
            html_url: 'https://github.com/o/r/releases/tag/cc-51015/ed1',
            prerelease: false
          }
        });
      }
    );

    const publisher = new GitHubReleasePublisher(octokit, {
      owner: 'o',
      repo: 'r'
    });
    const tag = ReleaseTag.from(
      DocumentId.fromRaw('cc-51015'),
      DocumentVersion.from('1', DocumentStage.fromStatus('published'))
    );
    const hash = ContentHash.fromString('deadbeef');
    const doc = makeDoc();

    await publisher.publish(tag, assetPath, hash, doc, false);

    expect(capturedBody).toContain('content-hash:deadbeef');
    expect(capturedBody).toContain('cc-51015');
    expect(capturedBody).toContain('published');
    expect(capturedBody).toContain('mn-release-metadata');
  });

  it('sets prerelease flag on release body', async () => {
    let capturedPreRelease = false;
    const octokit = mockOctokit({
      createRelease: {
        data: {
          id: 42,
          tag_name: 'cc-51015/ed2-wd',
          html_url: 'https://github.com/o/r/releases/tag/cc-51015/ed2-wd',
          prerelease: true
        }
      }
    });
    octokit.rest.repos.createRelease.mockImplementation(
      (params: { prerelease?: boolean }) => {
        capturedPreRelease = params.prerelease ?? false;
        return Promise.resolve({
          data: {
            id: 42,
            tag_name: 'cc-51015/ed2-wd',
            html_url: 'https://github.com/o/r/releases/tag/cc-51015/ed2-wd',
            prerelease: true
          }
        });
      }
    );

    const publisher = new GitHubReleasePublisher(octokit, {
      owner: 'o',
      repo: 'r'
    });
    const tag = ReleaseTag.from(
      DocumentId.fromRaw('cc-51015'),
      DocumentVersion.from('2', DocumentStage.fromStatus('working-draft'))
    );
    const hash = ContentHash.fromString('abc');
    const doc = makeDoc({
      version: DocumentVersion.from(
        '2',
        DocumentStage.fromStatus('working-draft')
      )
    });

    await publisher.publish(tag, assetPath, hash, doc, true);

    expect(capturedPreRelease).toBe(true);
  });

  it('force-replaces published release by deleting and recreating', async () => {
    const octokit = mockOctokit({
      'getReleaseByTag:cc-51015/ed1': {
        data: {
          id: 10,
          tag_name: 'cc-51015/ed1',
          html_url: 'https://github.com/o/r/releases/tag/cc-51015/ed1',
          prerelease: false,
          body: 'content-hash:old',
          assets: [{ id: 100, name: 'old.zip' }]
        }
      },
      createRelease: {
        data: {
          id: 99,
          tag_name: 'cc-51015/ed1',
          html_url: 'https://github.com/o/r/releases/tag/cc-51015/ed1',
          prerelease: false
        }
      }
    });

    const publisher = new GitHubReleasePublisher(octokit, {
      owner: 'o',
      repo: 'r'
    });
    const tag = ReleaseTag.from(
      DocumentId.fromRaw('cc-51015'),
      DocumentVersion.from('1', DocumentStage.fromStatus('published'))
    );
    const hash = ContentHash.fromString('newhash');
    const doc = makeDoc();

    const result = await publisher.publish(
      tag, assetPath, hash, doc, false, undefined,
      [Channel.public('standards')], true
    );

    expect(result.created).toBe(true);
    expect(octokit.rest.repos.deleteRelease).toHaveBeenCalledWith(
      expect.objectContaining({ release_id: 10 })
    );
    expect(octokit.rest.git.deleteRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'tags/cc-51015/ed1' })
    );
    expect(octokit.rest.repos.createRelease).toHaveBeenCalledOnce();
    expect(octokit.rest.repos.updateRelease).not.toHaveBeenCalled();
  });
});
