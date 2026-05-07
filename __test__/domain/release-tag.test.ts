import { describe, it, expect } from 'vitest';
import {
  ReleaseTag,
  DocumentId,
  DocumentVersion,
  DocumentStage
} from '../../src/domain/types.js';

describe('ReleaseTag', () => {
  describe('from', () => {
    it('CC published tag', () => {
      const id = DocumentId.fromRaw('CC 51015');
      const stage = DocumentStage.fromStatus('published');
      const version = DocumentVersion.from('1', stage);
      const tag = ReleaseTag.from(id, version);
      expect(tag.toString()).toBe('cc-51015/ed1');
      expect(tag.isPreRelease).toBe(false);
    });

    it('CC draft tag', () => {
      const id = DocumentId.fromRaw('CC 51015');
      const stage = DocumentStage.fromStatus('working-draft');
      const version = DocumentVersion.from('2', stage);
      const tag = ReleaseTag.from(id, version);
      expect(tag.toString()).toBe('cc-51015/ed2-wd');
      expect(tag.isPreRelease).toBe(true);
    });

    it('ISO published tag', () => {
      const id = DocumentId.fromRaw('ISO 8601-1:2019');
      const stage = DocumentStage.fromStatus('published');
      const version = DocumentVersion.from('1', stage);
      const tag = ReleaseTag.from(id, version);
      expect(tag.toString()).toBe('iso-8601-1-2019/ed1');
    });

    it('ISO draft tag', () => {
      const id = DocumentId.fromRaw('ISO/WD 8601-1:2026');
      const stage = DocumentStage.fromStatus('working-draft');
      const version = DocumentVersion.from('2', stage);
      const tag = ReleaseTag.from(id, version);
      expect(tag.toString()).toBe('iso-wd-8601-1-2026/ed2-wd');
    });
  });

  describe('parse', () => {
    it('parses published tag', () => {
      const tag = ReleaseTag.parse('cc-51015/ed1');
      expect(tag.toString()).toBe('cc-51015/ed1');
      expect(tag.isPreRelease).toBe(false);
    });

    it('parses draft tag', () => {
      const tag = ReleaseTag.parse('cc-51015/ed2-wd');
      expect(tag.toString()).toBe('cc-51015/ed2-wd');
      expect(tag.isPreRelease).toBe(true);
    });

    it('roundtrips via from then parse', () => {
      const id = DocumentId.fromRaw('CC 51015');
      const stage = DocumentStage.fromStatus('published');
      const version = DocumentVersion.from('1', stage);
      const original = ReleaseTag.from(id, version);
      const parsed = ReleaseTag.parse(original.toString());
      expect(parsed.equals(original)).toBe(true);
    });

    it('throws on tag without slash', () => {
      expect(() => ReleaseTag.parse('noslash')).toThrow(
        'Invalid release tag format'
      );
    });
  });

  describe('equals', () => {
    it('same tags are equal', () => {
      const a = ReleaseTag.parse('cc-51015/ed1');
      const b = ReleaseTag.parse('cc-51015/ed1');
      expect(a.equals(b)).toBe(true);
    });

    it('different tags are not equal', () => {
      const a = ReleaseTag.parse('cc-51015/ed1');
      const b = ReleaseTag.parse('cc-51015/ed2-wd');
      expect(a.equals(b)).toBe(false);
    });
  });
});
