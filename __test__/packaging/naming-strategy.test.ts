import { describe, it, expect } from 'vitest';
import {
  StandardNamingStrategy,
  IetfDraftNamingStrategy,
  IetfRfcNamingStrategy,
  getNamingStrategy
} from '../../src/packaging/naming-strategy.js';
import {
  DocumentId,
  DocumentVersion,
  DocumentStage
} from '../../src/domain/types.js';
import { DocumentType } from '../../src/domain/document-metadata.js';

describe('Naming Strategies', () => {
  describe('StandardNamingStrategy', () => {
    const strategy = new StandardNamingStrategy();

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

    it('computes ISO published tag', () => {
      const id = DocumentId.fromRaw('ISO 8601-1:2019');
      const version = DocumentVersion.from(
        '1',
        DocumentStage.fromStatus('published')
      );
      const tag = strategy.computeTag(id, version);
      expect(tag.toString()).toBe('iso-8601-1-2019/ed1');
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
  });

  describe('IetfDraftNamingStrategy', () => {
    const strategy = new IetfDraftNamingStrategy();

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

    it('falls back to standard for non-matching id', () => {
      const id = DocumentId.fromRaw('draft-other');
      const version = DocumentVersion.from(
        '1',
        DocumentStage.fromStatus('standard')
      );
      const tag = strategy.computeTag(id, version);
      expect(tag.toString()).toBe('draft-other/ed1');
    });
  });

  describe('IetfRfcNamingStrategy', () => {
    const strategy = new IetfRfcNamingStrategy();

    it('computes RFC tag', () => {
      const id = DocumentId.fromRaw('RFC 8984');
      const version = DocumentVersion.from(
        '1',
        DocumentStage.fromStatus('published')
      );
      const tag = strategy.computeTag(id, version);
      expect(tag.toString()).toBe('rfc-8984/ed1');
    });

    it('computes RFC asset name', () => {
      const id = DocumentId.fromRaw('RFC 8984');
      const version = DocumentVersion.from(
        '1',
        DocumentStage.fromStatus('published')
      );
      expect(strategy.computeAssetName(id, version)).toBe('rfc-8984.zip');
    });
  });

  describe('getNamingStrategy', () => {
    it('returns Standard for Standard type', () => {
      expect(getNamingStrategy(DocumentType.Standard)).toBeInstanceOf(
        StandardNamingStrategy
      );
    });

    it('returns IetfDraft for IetfDraft type', () => {
      expect(getNamingStrategy(DocumentType.IetfDraft)).toBeInstanceOf(
        IetfDraftNamingStrategy
      );
    });

    it('returns IetfRfc for IetfRfc type', () => {
      expect(getNamingStrategy(DocumentType.IetfRfc)).toBeInstanceOf(
        IetfRfcNamingStrategy
      );
    });
  });
});
