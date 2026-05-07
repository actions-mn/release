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
import { ReleaseManifest } from '../src/domain/release-manifest.js';
import { Visibility } from '../src/domain/types.js';

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
    documentType: DocumentType.Standard,
    revdate: undefined,
    sourcePath: sourcePath ?? `sources/${id.toString()}.adoc`,
    outputDir: `/tmp/site/${id.toString()}`,
    formats: ['html', 'pdf']
  };
}

function makeConfig(): ReleaseConfig {
  return {
    sourcePath: '.',
    outputDir: '_site',
    configFile: 'metanorma.yml',
    releaseConfigFile: 'metanorma.release.yml',
    workspacePath: '/workspace',
    agreeToTerms: true,
    installFonts: true,
    continueWithoutFonts: true,
    useBundler: false,
    force: false,
    includePattern: '*',
    token: 'fake-token',
    repo: { owner: 'test', repo: 'repo' }
  };
}

function createMockDeps(
  options: {
    changedDocs?: string[];
    manifest?: ReleaseManifest;
  } = {}
): {
  deps: PipelineDependencies;
  extractor: { extract: ReturnType<typeof vi.fn> };
  discoverDocuments: ReturnType<typeof vi.fn>;
} {
  const allDocs = [
    makeDoc('CC 51015'),
    makeDoc('CC 51024'),
    makeDoc('CC 51026')
  ];

  const changedSet = new Set(options.changedDocs ?? ['CC 51015']);

  const extractor = {
    extract: vi.fn().mockImplementation((rxlPath: string) => {
      const fileName = rxlPath.split('/').pop()?.replace('.rxl', '') ?? '';
      return Promise.resolve(
        makeDoc(fileName.replace(/-/g, ' ').toUpperCase())
      );
    })
  };

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
      zipSize: 1024
    } as ArtifactResult)
  };

  const publisher = {
    publish: vi.fn().mockResolvedValue({
      tag: 'test/ed1',
      url: 'https://github.com/test/repo/releases/tag/test/ed1',
      created: true
    } as PublishResult)
  };

  const visibilityFilter = {
    filter: vi.fn().mockImplementation((docs: DocumentMetadata[]) => {
      const manifest = options.manifest ?? ReleaseManifest.allPublic();
      return docs.filter((doc) => manifest.isPublic(doc.sourcePath));
    })
  };

  return {
    deps: {
      extractor,
      changeDetector,
      packager,
      publisher,
      visibilityFilter
    },
    extractor,
    discoverDocuments: vi.fn()
  };
}

// We need to mock the compilation and discovery steps
vi.mock('../src/compilation/metanorma-compiler.js', () => ({
  MetanormaCompiler: vi.fn().mockImplementation(function () {
    return { compile: vi.fn().mockResolvedValue('1.12.0') };
  })
}));

vi.mock('../src/extractors/rxl-extractor.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../src/extractors/rxl-extractor.js')>();
  return {
    ...original,
    discoverDocuments: vi.fn()
  };
});

describe('ReleasePipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path: 3 docs, 1 changed → 1 released, 2 skipped', async () => {
    const config = makeConfig();
    const { deps } = createMockDeps({ changedDocs: ['cc-51015'] });
    const docs = [
      makeDoc('CC 51015'),
      makeDoc('CC 51024'),
      makeDoc('CC 51026')
    ];

    const { discoverDocuments } =
      await import('../src/extractors/rxl-extractor.js');
    vi.mocked(discoverDocuments).mockResolvedValue(docs);

    const pipeline = new ReleasePipeline(config, deps);
    const result = await pipeline.execute();

    expect(result.released).toHaveLength(1);
    expect(result.skipped).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
    expect(result.released[0].id.toString()).toBe('cc-51015');
  });

  it('all unchanged → all skipped', async () => {
    const config = makeConfig();
    const { deps } = createMockDeps({ changedDocs: [] });
    const docs = [makeDoc('CC 51015'), makeDoc('CC 51024')];

    const { discoverDocuments } =
      await import('../src/extractors/rxl-extractor.js');
    vi.mocked(discoverDocuments).mockResolvedValue(docs);

    const pipeline = new ReleasePipeline(config, deps);
    const result = await pipeline.execute();

    expect(result.released).toHaveLength(0);
    expect(result.skipped).toHaveLength(2);
  });

  it('force mode → all released', async () => {
    const config = { ...makeConfig(), force: true };
    const allChangedDeps = createMockDeps();
    // Force mode: change detector always returns changed
    allChangedDeps.deps.changeDetector.detect = vi.fn().mockResolvedValue({
      changed: true,
      currentHash: ContentHash.fromString('abc')
    });
    const docs = [makeDoc('CC 51015')];

    const { discoverDocuments } =
      await import('../src/extractors/rxl-extractor.js');
    vi.mocked(discoverDocuments).mockResolvedValue(docs);

    const pipeline = new ReleasePipeline(config, allChangedDeps.deps);
    const result = await pipeline.execute();

    expect(result.released).toHaveLength(1);
  });

  it('one document fails → others continue', async () => {
    const config = makeConfig();
    const { deps } = createMockDeps({ changedDocs: ['cc-51015', 'cc-51024'] });
    deps.packager.package = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('Packaging failed');
      })
      .mockResolvedValue({ zipPath: '/tmp/test.zip', zipSize: 1024 });

    const docs = [makeDoc('CC 51015'), makeDoc('CC 51024')];

    const { discoverDocuments } =
      await import('../src/extractors/rxl-extractor.js');
    vi.mocked(discoverDocuments).mockResolvedValue(docs);

    const pipeline = new ReleasePipeline(config, deps);
    const result = await pipeline.execute();

    expect(result.failed).toHaveLength(1);
    expect(result.released).toHaveLength(1);
  });

  it('empty site → 0 documents, no errors', async () => {
    const config = makeConfig();
    const { deps } = createMockDeps();

    const { discoverDocuments } =
      await import('../src/extractors/rxl-extractor.js');
    vi.mocked(discoverDocuments).mockResolvedValue([]);

    const pipeline = new ReleasePipeline(config, deps);
    const result = await pipeline.execute();

    expect(result.released).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });

  it('visibility filter removes private docs', async () => {
    const config = makeConfig();
    const manifest = ReleaseManifest.parse({
      documents: [
        { source: 'sources/cc-51015.adoc' },
        { source: 'sources/cc-51026.adoc', visibility: 'private' }
      ]
    });
    const { deps } = createMockDeps({
      changedDocs: ['cc-51015', 'cc-51026'],
      manifest
    });
    // Override the visibilityFilter mock to use actual logic
    deps.visibilityFilter.filter = vi
      .fn()
      .mockImplementation((docs: DocumentMetadata[]) =>
        docs.filter((doc) => manifest.isPublic(doc.sourcePath))
      );
    const docs = [makeDoc('CC 51015'), makeDoc('CC 51026')];

    const { discoverDocuments } =
      await import('../src/extractors/rxl-extractor.js');
    vi.mocked(discoverDocuments).mockResolvedValue(docs);

    const pipeline = new ReleasePipeline(config, deps);
    const result = await pipeline.execute();

    expect(result.released).toHaveLength(1);
    expect(result.released[0].id.toString()).toBe('cc-51015');
  });
});
