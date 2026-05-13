import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DocumentId,
  DocumentStage,
  DocumentVersion,
  ReleaseTag,
  ContentHash,
  type ChangeDetectorResult,
  type ArtifactResult,
  type PublishResult
} from '../src/domain/types.js';
import { DocumentType } from '../src/domain/document-metadata.js';
import type { DocumentMetadata } from '../src/domain/document-metadata.js';
import type { ReleaseConfig } from '../src/input-helper.js';
import { ReleasePipeline, type PipelineDependencies } from '../src/pipeline.js';
import { ChannelManifest } from '../src/domain/channel-manifest.js';
import { Channel } from '../src/domain/channel.js';
import { createDefaultRegistry } from '../src/packaging/naming-strategy.js';

function makeDoc(
  rawId: string,
  edition: string = '1',
  status: string = 'published',
  sourcePath?: string
): DocumentMetadata {
  const id = DocumentId.fromRaw(rawId);
  return {
    id,
    title: rawId,
    version: DocumentVersion.from(edition, DocumentStage.fromStatus(status)),
    doctype: 'standard',
    documentType: DocumentType.fromIdentifier(rawId),
    flavor: undefined,
    revdate: undefined,
    sourcePath: sourcePath ?? `sources/${id.toString()}.adoc`,
    outputDir: `/tmp/site/${id.toString()}`,
    formats: ['html', 'pdf'],
    fileBaseName: id.fileName
  };
}

function makeConfig(overrides: Partial<ReleaseConfig> = {}): ReleaseConfig {
  return {
    sourcePath: '.',
    outputDir: '_site',
    releaseConfigFile: 'metanorma.release.yml',
    workspacePath: '/workspace',
    defaultVisibility: 'public',
    force: false,
    forceReplace: [],
    includePattern: '*',
    token: 'fake-token',
    repo: { owner: 'test', repo: 'repo' },
    concurrency: 4,
    stages: [],
    channels: [],
    extractionFailureThreshold: 0.5,
    ...overrides
  };
}

function createMockDeps(
  options: {
    changedDocs?: string[];
    manifest?: ChannelManifest;
    includePattern?: string;
  } = {}
): {
  deps: PipelineDependencies;
  mockDiscover: ReturnType<typeof vi.fn>;
} {
  const changedSet = new Set(options.changedDocs ?? ['CC 51015']);

  const mockDiscover = vi.fn();

  const extractor = {
    discover: mockDiscover,
    extract: vi.fn()
  };

  const manifest = options.manifest ?? ChannelManifest.allPublic();

  const changeDetector = {
    detect: vi
      .fn()
      .mockImplementation(
        (metadata: DocumentMetadata): Promise<ChangeDetectorResult> => {
          const changed = changedSet.has(metadata.id.toString());
          return Promise.resolve({
            changed,
            currentHash: ContentHash.fromString('abc123'),
            previousHash: changed ? undefined : ContentHash.fromString('abc123')
          });
        }
      )
  };

  const packager = {
    package: vi.fn().mockResolvedValue({
      zipPath: '/tmp/test.zip',
      zipSize: 1024,
      assetName: 'test-ed1.zip'
    } as ArtifactResult)
  };

  const publisher = {
    publish: vi.fn().mockResolvedValue({
      tag: ReleaseTag.create('test/ed1', false),
      url: 'https://github.com/test/repo/releases/tag/test/ed1',
      created: true
    } as PublishResult)
  };

  const channelManifestFilter = {
    filter: vi
      .fn()
      .mockImplementation((docs: readonly DocumentMetadata[]) =>
        docs.filter((doc) => manifest.resolve(doc).shouldRelease)
      )
  };

  const patternFilter = {
    filter: vi.fn().mockImplementation((docs: readonly DocumentMetadata[]) => {
      const pattern = options.includePattern ?? '*';
      if (pattern === '*') return [...docs];
      return docs.filter((doc) => doc.id.toString() === pattern);
    })
  };

  return {
    deps: {
      extractor,
      filters: [channelManifestFilter, patternFilter],
      changeDetector,
      packager,
      publisher,
      namingRegistry: createDefaultRegistry(),
      manifest
    },
    mockDiscover
  };
}

describe('ReleasePipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path: 3 docs, 1 changed → 1 released, 2 skipped', async () => {
    const config = makeConfig();
    const { deps, mockDiscover } = createMockDeps({
      changedDocs: ['cc-51015']
    });
    const docs = [
      makeDoc('CC 51015'),
      makeDoc('CC 51024'),
      makeDoc('CC 51026')
    ];

    mockDiscover.mockResolvedValue(docs);

    const pipeline = new ReleasePipeline(config, deps);
    const result = await pipeline.execute();

    expect(result.released).toHaveLength(1);
    expect(result.skipped).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
    expect(result.released[0].id.toString()).toBe('cc-51015');
  });

  it('all unchanged → all skipped', async () => {
    const config = makeConfig();
    const { deps, mockDiscover } = createMockDeps({ changedDocs: [] });
    const docs = [makeDoc('CC 51015'), makeDoc('CC 51024')];

    mockDiscover.mockResolvedValue(docs);

    const pipeline = new ReleasePipeline(config, deps);
    const result = await pipeline.execute();

    expect(result.released).toHaveLength(0);
    expect(result.skipped).toHaveLength(2);
  });

  it('force mode → all released', async () => {
    const config = makeConfig({ force: true });
    const { deps, mockDiscover } = createMockDeps();
    deps.changeDetector.detect = vi.fn().mockResolvedValue({
      changed: true,
      currentHash: ContentHash.fromString('abc')
    });
    const docs = [makeDoc('CC 51015')];

    mockDiscover.mockResolvedValue(docs);

    const pipeline = new ReleasePipeline(config, deps);
    const result = await pipeline.execute();

    expect(result.released).toHaveLength(1);
  });

  it('one document fails → others continue', async () => {
    const config = makeConfig();
    const { deps, mockDiscover } = createMockDeps({
      changedDocs: ['cc-51015', 'cc-51024']
    });
    deps.packager.package = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('Packaging failed');
      })
      .mockResolvedValue({
        zipPath: '/tmp/test.zip',
        zipSize: 1024,
        assetName: 'test.zip'
      });

    const docs = [makeDoc('CC 51015'), makeDoc('CC 51024')];

    mockDiscover.mockResolvedValue(docs);

    const pipeline = new ReleasePipeline(config, deps);
    const result = await pipeline.execute();

    expect(result.failed).toHaveLength(1);
    expect(result.released).toHaveLength(1);
  });

  it('empty site → 0 documents, no errors', async () => {
    const config = makeConfig();
    const { deps, mockDiscover } = createMockDeps();

    mockDiscover.mockResolvedValue([]);

    const pipeline = new ReleasePipeline(config, deps);
    const result = await pipeline.execute();

    expect(result.released).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });

  it('visibility filter removes private docs', async () => {
    const config = makeConfig();
    const manifest = ChannelManifest.parse({
      documents: [
        { source: 'sources/cc-51015.adoc' },
        { source: 'sources/cc-51026.adoc', visibility: 'private' }
      ]
    });
    const { deps, mockDiscover } = createMockDeps({
      changedDocs: ['cc-51015', 'cc-51026'],
      manifest
    });
    deps.filters = [
      {
        filter: vi
          .fn()
          .mockImplementation((docs: readonly DocumentMetadata[]) =>
            docs.filter((doc) => manifest.resolve(doc).shouldRelease)
          )
      },
      {
        filter: vi
          .fn()
          .mockImplementation((docs: readonly DocumentMetadata[]) => [...docs])
      }
    ];
    const docs = [makeDoc('CC 51015'), makeDoc('CC 51026')];

    mockDiscover.mockResolvedValue(docs);

    const pipeline = new ReleasePipeline(config, deps);
    const result = await pipeline.execute();

    expect(result.released).toHaveLength(1);
    expect(result.released[0].id.toString()).toBe('cc-51015');
  });

  it('pattern filter narrows scope', async () => {
    const config = makeConfig({ includePattern: 'cc-51015' });
    const { deps, mockDiscover } = createMockDeps({
      changedDocs: ['cc-51015'],
      includePattern: 'cc-51015'
    });
    const docs = [makeDoc('CC 51015'), makeDoc('CC 51024')];

    mockDiscover.mockResolvedValue(docs);

    const pipeline = new ReleasePipeline(config, deps);
    const result = await pipeline.execute();

    expect(result.released).toHaveLength(1);
    expect(result.released[0].id.toString()).toBe('cc-51015');
  });

  it('calls extractor.discover with correct output path', async () => {
    const config = makeConfig({
      workspacePath: '/workspace',
      outputDir: '_site'
    });
    const { deps, mockDiscover } = createMockDeps();

    mockDiscover.mockResolvedValue([]);

    const pipeline = new ReleasePipeline(config, deps);
    await pipeline.execute();

    expect(mockDiscover).toHaveBeenCalledWith('/workspace/_site');
  });

  it('channelOverride overrides manifest channels', async () => {
    const config = makeConfig();
    const { deps, mockDiscover } = createMockDeps({
      changedDocs: ['cc-51015']
    });
    const overrideChannels = [Channel.parse('public/guides')];
    deps.channelOverride = overrideChannels;
    const docs = [makeDoc('CC 51015')];

    mockDiscover.mockResolvedValue(docs);

    const pipeline = new ReleasePipeline(config, deps);
    const result = await pipeline.execute();

    expect(result.released).toHaveLength(1);
    expect(deps.publisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      overrideChannels,
      false
    );
  });

  it('tracks releasedArtifacts with id, tag, url, channels', async () => {
    const config = makeConfig();
    const { deps, mockDiscover } = createMockDeps({
      changedDocs: ['cc-51015']
    });
    const docs = [makeDoc('CC 51015')];

    mockDiscover.mockResolvedValue(docs);

    const pipeline = new ReleasePipeline(config, deps);
    const result = await pipeline.execute();

    expect(result.releasedArtifacts).toHaveLength(1);
    expect(result.releasedArtifacts[0].id).toBe('cc-51015');
    expect(result.releasedArtifacts[0].url).toBe(
      'https://github.com/test/repo/releases/tag/test/ed1'
    );
    expect(result.releasedArtifacts[0].channels).toEqual(['public/default']);
  });

  it('force-replace matching doc bypasses change detection', async () => {
    const config = makeConfig({ forceReplace: ['cc-51015'] });
    const { deps, mockDiscover } = createMockDeps({ changedDocs: [] });
    const docs = [makeDoc('CC 51015'), makeDoc('CC 51024')];

    mockDiscover.mockResolvedValue(docs);

    const pipeline = new ReleasePipeline(config, deps);
    const result = await pipeline.execute();

    expect(result.released).toHaveLength(1);
    expect(result.released[0].id.toString()).toBe('cc-51015');
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].id.toString()).toBe('cc-51024');
    expect(deps.publisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      true
    );
  });

  it('force-replace with glob pattern matches multiple docs', async () => {
    const config = makeConfig({ forceReplace: ['cc-51*'] });
    const { deps, mockDiscover } = createMockDeps({ changedDocs: [] });
    const docs = [makeDoc('CC 51015'), makeDoc('CC 51024'), makeDoc('CC 62001')];

    mockDiscover.mockResolvedValue(docs);

    const pipeline = new ReleasePipeline(config, deps);
    const result = await pipeline.execute();

    expect(result.released).toHaveLength(2);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].id.toString()).toBe('cc-62001');
  });
});
