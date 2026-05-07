import { describe, it, expect } from 'vitest';
import { DocumentStage } from '../../src/domain/types.js';

describe('DocumentStage', () => {
  describe('fromStatus', () => {
    it.each([
      ['published', 'published'],
      ['working-draft', 'working-draft'],
      ['committee-draft', 'committee-draft'],
      ['draft-standard', 'draft-standard'],
      ['final-draft', 'final-draft'],
      ['proposal', 'proposal'],
      ['withdrawn', 'withdrawn'],
      ['cancelled', 'cancelled']
    ] as const)('maps "%s" correctly', (status, expected) => {
      const stage = DocumentStage.fromStatus(status);
      expect(stage.toString()).toBe(expected);
    });

    it('throws on unknown stage', () => {
      expect(() => DocumentStage.fromStatus('unknown')).toThrow(
        'Unknown stage'
      );
    });
  });

  describe('fromIsoStage', () => {
    it.each([
      [20, 20, 'working-draft'],
      [20, 99, 'working-draft'],
      [30, 0, 'committee-draft'],
      [30, 99, 'committee-draft'],
      [40, 0, 'draft-standard'],
      [40, 99, 'draft-standard'],
      [50, 0, 'final-draft'],
      [50, 99, 'final-draft'],
      [60, 60, 'published'],
      [60, 0, 'published'],
      [95, 0, 'withdrawn'],
      [95, 99, 'withdrawn']
    ] as const)(
      'maps ISO stage %d.%d to %s',
      (docstage, docsubstage, expected) => {
        const stage = DocumentStage.fromIsoStage(docstage, docsubstage);
        expect(stage.toString()).toBe(expected);
      }
    );
  });

  describe('isPublished', () => {
    it('returns true for published', () => {
      expect(DocumentStage.fromStatus('published').isPublished).toBe(true);
    });

    it('returns true for in-force', () => {
      expect(DocumentStage.fromStatus('in-force').isPublished).toBe(true);
    });

    it('returns false for working-draft', () => {
      expect(DocumentStage.fromStatus('working-draft').isPublished).toBe(false);
    });

    it('returns false for withdrawn', () => {
      expect(DocumentStage.fromStatus('withdrawn').isPublished).toBe(false);
    });
  });

  describe('isDraft', () => {
    it('returns true for working-draft', () => {
      expect(DocumentStage.fromStatus('working-draft').isDraft).toBe(true);
    });

    it('returns true for committee-draft', () => {
      expect(DocumentStage.fromStatus('committee-draft').isDraft).toBe(true);
    });

    it('returns false for published', () => {
      expect(DocumentStage.fromStatus('published').isDraft).toBe(false);
    });

    it('returns false for withdrawn', () => {
      expect(DocumentStage.fromStatus('withdrawn').isDraft).toBe(false);
    });
  });

  describe('tagSuffix', () => {
    it.each([
      ['published', ''],
      ['in-force', ''],
      ['working-draft', 'wd'],
      ['committee-draft', 'cd'],
      ['draft-standard', 'ds'],
      ['final-draft', 'fd'],
      ['proposal', 'proposal'],
      ['withdrawn', 'withdrawn'],
      ['cancelled', 'cancelled']
    ] as const)('suffix for %s is "%s"', (status, expected) => {
      const stage = DocumentStage.fromStatus(status);
      expect(stage.tagSuffix).toBe(expected);
    });
  });
});
