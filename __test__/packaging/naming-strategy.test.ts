import { describe, it, expect } from 'vitest';
import {
  EditionNamingStrategy,
  VersionNamingStrategy,
  InternetDraftNamingStrategy,
  RfcNamingStrategy,
  DraftSuffixNamingStrategy,
  NamingStrategyRegistry,
  createDefaultRegistry
} from '../../src/packaging/naming-strategy.js';
import {
  DocumentId,
  DocumentVersion,
  DocumentStage
} from '../../src/domain/types.js';
import { DocumentType } from '../../src/domain/document-metadata.js';

describe('Naming Strategies', () => {
  describe('EditionNamingStrategy', () => {
    const strategy = new EditionNamingStrategy();

    it('computes CC published tag', () => {
      const id = DocumentId.fromRaw('CC 51015');
      const version = DocumentVersion.from(
        '1',
        DocumentStage.fromStatus('published')
      );
      const tag = strategy.computeTag(id, version);
      expect(tag.toString()).toBe('cc-51015/ed1');
    });

    it('computes CC draft tag', () => {
      const id = DocumentId.fromRaw('CC 51015');
      const version = DocumentVersion.from(
        '2',
        DocumentStage.fromStatus('working-draft')
      );
      const tag = strategy.computeTag(id, version);
      expect(tag.toString()).toBe('cc-51015/ed2-wd');
    });

    it('computes asset name', () => {
      const id = DocumentId.fromRaw('CC 51015');
      const version = DocumentVersion.from(
        '1',
        DocumentStage.fromStatus('published')
      );
      expect(strategy.computeAssetName(id, version)).toBe('cc-51015-ed1.zip');
    });

    it('computes canonical base', () => {
      const id = DocumentId.fromRaw('CC 51015');
      const version = DocumentVersion.from(
        '1',
        DocumentStage.fromStatus('published')
      );
      expect(strategy.computeCanonicalBase(id, version)).toBe('cc-51015-ed1');
    });

    it('ISO: tag for published document', () => {
      const id = DocumentId.fromRaw('ISO 8601-1:2019');
      const version = DocumentVersion.from(
        '1',
        DocumentStage.fromStatus('published')
      );
      expect(strategy.computeTag(id, version).toString()).toBe(
        'iso-8601-1-2019/ed1'
      );
    });

    it('ISO: tag for draft document', () => {
      const id = DocumentId.fromRaw('ISO/WD 8601-1:2026');
      const version = DocumentVersion.from(
        '2',
        DocumentStage.fromStatus('working-draft')
      );
      expect(strategy.computeTag(id, version).toString()).toBe(
        'iso-wd-8601-1-2026/ed2-wd'
      );
    });

    it('IEC: tag with edition', () => {
      const id = DocumentId.fromRaw('IEC CD 17301-1:2016 ED2');
      const version = DocumentVersion.from(
        '2',
        DocumentStage.fromStatus('committee-draft')
      );
      expect(strategy.computeTag(id, version).toString()).toBe(
        'iec-cd-17301-1-2016-ed2/ed2-cd'
      );
    });

    it('ITU-T: tag', () => {
      const id = DocumentId.fromRaw('ITU-T G.650.1');
      const version = DocumentVersion.from(
        '1',
        DocumentStage.fromStatus('published')
      );
      expect(strategy.computeTag(id, version).toString()).toBe(
        'itu-t-g-650-1/ed1'
      );
    });

    it('BIPM: tag with decimal edition', () => {
      const id = DocumentId.fromRaw('BIPM CIPM MRA-D-02');
      const version = DocumentVersion.from(
        '3.3',
        DocumentStage.fromStatus('published')
      );
      expect(strategy.computeTag(id, version).toString()).toBe(
        'bipm-cipm-mra-d-02/ed3.3'
      );
    });

    it('OIML: tag', () => {
      const id = DocumentId.fromRaw('OIML R 60');
      const version = DocumentVersion.from(
        '2021',
        DocumentStage.fromStatus('published')
      );
      expect(strategy.computeTag(id, version).toString()).toBe(
        'oiml-r-60/ed2021'
      );
    });

    it('CSA: tag', () => {
      const id = DocumentId.fromRaw('csa-01:2019');
      const version = DocumentVersion.from(
        '2019',
        DocumentStage.fromStatus('published')
      );
      expect(strategy.computeTag(id, version).toString()).toBe(
        'csa-01-2019/ed2019'
      );
    });
  });

  describe('VersionNamingStrategy', () => {
    const strategy = new VersionNamingStrategy();

    it('IHO: semver-like edition format', () => {
      const id = DocumentId.fromRaw('S-102');
      const version = DocumentVersion.from(
        '2.1.0',
        DocumentStage.fromStatus('published')
      );
      const tag = strategy.computeTag(id, version);
      expect(tag.toString()).toBe('s-102/v2.1.0');
    });

    it('IHO: asset name', () => {
      const id = DocumentId.fromRaw('S-102');
      const version = DocumentVersion.from(
        '2.1.0',
        DocumentStage.fromStatus('published')
      );
      expect(strategy.computeAssetName(id, version)).toBe('s-102-v2.1.0.zip');
    });

    it('IHO: canonical base', () => {
      const id = DocumentId.fromRaw('S-102');
      const version = DocumentVersion.from(
        '2.1.0',
        DocumentStage.fromStatus('published')
      );
      expect(strategy.computeCanonicalBase(id, version)).toBe('s-102-v2.1.0');
    });

    it('OGC: version-based edition format', () => {
      const id = DocumentId.fromRaw('17-069r3');
      const version = DocumentVersion.from(
        '1.0',
        DocumentStage.fromStatus('published')
      );
      const tag = strategy.computeTag(id, version);
      expect(tag.toString()).toBe('17-069r3/v1.0');
    });

    it('OGC: asset name', () => {
      const id = DocumentId.fromRaw('17-069r3');
      const version = DocumentVersion.from(
        '1.0',
        DocumentStage.fromStatus('published')
      );
      expect(strategy.computeAssetName(id, version)).toBe('17-069r3-v1.0.zip');
    });
  });

  describe('InternetDraftNamingStrategy', () => {
    const strategy = new InternetDraftNamingStrategy();

    it('computes I-D tag', () => {
      const id = DocumentId.fromRaw('draft-ietf-calext-jscalendar-32');
      const version = DocumentVersion.from(
        '32',
        DocumentStage.fromStatus('standard')
      );
      const tag = strategy.computeTag(id, version);
      expect(tag.toString()).toBe('id-calext-jscalendar/32');
      expect(tag.isPreRelease).toBe(true);
    });

    it('computes I-D asset name', () => {
      const id = DocumentId.fromRaw('draft-ietf-calext-jscalendar-32');
      const version = DocumentVersion.from(
        '32',
        DocumentStage.fromStatus('standard')
      );
      expect(strategy.computeAssetName(id, version)).toBe(
        'draft-ietf-calext-jscalendar-32.zip'
      );
    });

    it('falls back for non-matching id', () => {
      const id = DocumentId.fromRaw('draft-other');
      const version = DocumentVersion.from(
        '1',
        DocumentStage.fromStatus('standard')
      );
      const tag = strategy.computeTag(id, version);
      expect(tag.toString()).toBe('draft-other/draft');
    });
  });

  describe('RfcNamingStrategy', () => {
    const strategy = new RfcNamingStrategy();

    it('computes RFC tag', () => {
      const id = DocumentId.fromRaw('RFC 8984');
      const version = DocumentVersion.from(
        '1',
        DocumentStage.fromStatus('published')
      );
      const tag = strategy.computeTag(id, version);
      expect(tag.toString()).toBe('rfc-8984/ed1');
    });

    it('computes RFC asset name (no edition)', () => {
      const id = DocumentId.fromRaw('RFC 8984');
      const version = DocumentVersion.from(
        '1',
        DocumentStage.fromStatus('published')
      );
      expect(strategy.computeAssetName(id, version)).toBe('rfc-8984.zip');
    });
  });

  describe('DraftSuffixNamingStrategy', () => {
    const strategy = new DraftSuffixNamingStrategy();

    it('extracts draft version from identifier suffix', () => {
      const id = DocumentId.fromRaw('IEEE Draft Std 987.6-2020/D3');
      const version = DocumentVersion.from(
        '1',
        DocumentStage.fromStatus('working-draft')
      );
      const tag = strategy.computeTag(id, version);
      expect(tag.toString()).toBe('ieee-draft-std-987-6-2020/3');
      expect(tag.isPreRelease).toBe(true);
    });

    it('computes asset name', () => {
      const id = DocumentId.fromRaw('IEEE Draft Std 987.6-2020/D3');
      const version = DocumentVersion.from(
        '1',
        DocumentStage.fromStatus('working-draft')
      );
      expect(strategy.computeAssetName(id, version)).toBe(
        'ieee-draft-std-987-6-2020-d3.zip'
      );
    });

    it('falls back to edition-based for non-draft identifiers', () => {
      const id = DocumentId.fromRaw('IEEE Std 802.3-2018');
      const version = DocumentVersion.from(
        '1',
        DocumentStage.fromStatus('published')
      );
      const tag = strategy.computeTag(id, version);
      expect(tag.toString()).toBe('ieee-std-802-3-2018/ed1');
    });
  });
});

describe('NamingStrategyRegistry', () => {
  it('returns registered strategy for known type', () => {
    const registry = new NamingStrategyRegistry(new EditionNamingStrategy());
    const draftStrategy = new InternetDraftNamingStrategy();
    registry.register(DocumentType.IetfDraft, draftStrategy);

    expect(registry.resolve(DocumentType.IetfDraft)).toBe(draftStrategy);
  });

  it('returns default for unregistered type', () => {
    const defaultStrategy = new EditionNamingStrategy();
    const registry = new NamingStrategyRegistry(defaultStrategy);

    expect(registry.resolve(DocumentType.Standard)).toBe(defaultStrategy);
  });

  it('returns default for unregistered future type', () => {
    const defaultStrategy = new EditionNamingStrategy();
    const registry = new NamingStrategyRegistry(defaultStrategy);

    expect(registry.resolve(DocumentType.Standard)).toBe(defaultStrategy);
  });

  it('register overwrites previous registration', () => {
    const registry = new NamingStrategyRegistry(new EditionNamingStrategy());
    const first = new InternetDraftNamingStrategy();
    const second = new InternetDraftNamingStrategy();
    registry.register(DocumentType.IetfDraft, first);
    registry.register(DocumentType.IetfDraft, second);

    expect(registry.resolve(DocumentType.IetfDraft)).toBe(second);
  });

  it('createDefaultRegistry resolves behavior-based strategies', () => {
    const registry = createDefaultRegistry();

    expect(registry.resolve(DocumentType.IetfDraft)).toBeInstanceOf(
      InternetDraftNamingStrategy
    );
    expect(registry.resolve(DocumentType.IetfRfc)).toBeInstanceOf(
      RfcNamingStrategy
    );
    expect(registry.resolve(DocumentType.Ieee)).toBeInstanceOf(
      DraftSuffixNamingStrategy
    );
    expect(registry.resolve(DocumentType.Iho)).toBeInstanceOf(
      VersionNamingStrategy
    );
    expect(registry.resolve(DocumentType.Ogc)).toBeInstanceOf(
      VersionNamingStrategy
    );
    // All other types fall through to EditionNamingStrategy
    expect(registry.resolve(DocumentType.Standard)).toBeInstanceOf(
      EditionNamingStrategy
    );
    expect(registry.resolve(DocumentType.Iso)).toBeInstanceOf(
      EditionNamingStrategy
    );
    expect(registry.resolve(DocumentType.Iec)).toBeInstanceOf(
      EditionNamingStrategy
    );
    expect(registry.resolve(DocumentType.Bipm)).toBeInstanceOf(
      EditionNamingStrategy
    );
    expect(registry.resolve(DocumentType.Oiml)).toBeInstanceOf(
      EditionNamingStrategy
    );
  });

  it('IHO and OGC share the same strategy instance', () => {
    const registry = createDefaultRegistry();
    expect(registry.resolve(DocumentType.Iho)).toBe(
      registry.resolve(DocumentType.Ogc)
    );
  });
});
