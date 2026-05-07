import { describe, it, expect } from 'vitest';
import {
  DocumentVersion,
  DocumentStage,
  DocumentId
} from '../../src/domain/types.js';

describe('DocumentVersion', () => {
  describe('from', () => {
    it('uses provided edition', () => {
      const stage = DocumentStage.fromStatus('published');
      const version = DocumentVersion.from('1', stage);
      expect(version.tagComponent).toBe('ed1');
    });

    it('defaults to "0" when edition is undefined', () => {
      const stage = DocumentStage.fromStatus('published');
      const version = DocumentVersion.from(undefined, stage);
      expect(version.tagComponent).toBe('ed0');
    });

    it('trims whitespace from edition', () => {
      const stage = DocumentStage.fromStatus('published');
      const version = DocumentVersion.from(' 2 ', stage);
      expect(version.tagComponent).toBe('ed2');
    });
  });

  describe('tagComponent', () => {
    it('published has no suffix', () => {
      const stage = DocumentStage.fromStatus('published');
      const version = DocumentVersion.from('1', stage);
      expect(version.tagComponent).toBe('ed1');
    });

    it('working-draft adds -wd suffix', () => {
      const stage = DocumentStage.fromStatus('working-draft');
      const version = DocumentVersion.from('2', stage);
      expect(version.tagComponent).toBe('ed2-wd');
    });

    it('committee-draft adds -cd suffix', () => {
      const stage = DocumentStage.fromStatus('committee-draft');
      const version = DocumentVersion.from('1', stage);
      expect(version.tagComponent).toBe('ed1-cd');
    });
  });

  describe('toFileName', () => {
    it('published document filename', () => {
      const stage = DocumentStage.fromStatus('published');
      const version = DocumentVersion.from('1', stage);
      const id = DocumentId.fromRaw('CC 51015');
      expect(version.toFileName(id)).toBe('cc-51015-ed1.zip');
    });

    it('draft document filename', () => {
      const stage = DocumentStage.fromStatus('working-draft');
      const version = DocumentVersion.from('2', stage);
      const id = DocumentId.fromRaw('CC 51015');
      expect(version.toFileName(id)).toBe('cc-51015-ed2-wd.zip');
    });
  });

  describe('isPreRelease', () => {
    it('published is not pre-release', () => {
      const stage = DocumentStage.fromStatus('published');
      const version = DocumentVersion.from('1', stage);
      expect(version.isPreRelease).toBe(false);
    });

    it('working-draft is pre-release', () => {
      const stage = DocumentStage.fromStatus('working-draft');
      const version = DocumentVersion.from('2', stage);
      expect(version.isPreRelease).toBe(true);
    });
  });
});
