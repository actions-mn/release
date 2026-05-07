import { describe, it, expect } from 'vitest';
import { DocumentId } from '../../src/domain/types.js';

describe('DocumentId', () => {
  describe('fromRaw', () => {
    it.each([
      ['CC 51015', 'cc-51015'],
      ['CC 34200', 'cc-34200'],
      ['ISO/WD 8601-1:2026', 'iso-wd-8601-1-2026'],
      ['ISO 8601-1:2019', 'iso-8601-1-2019'],
      ['ISO/CD 8601-2:2026', 'iso-cd-8601-2-2026'],
      ['ISO/DIS 8601-1', 'iso-dis-8601-1'],
      ['draft-ietf-calext-jscalendar-32', 'draft-ietf-calext-jscalendar-32'],
      ['RFC 8984', 'rfc-8984'],
      ['ITU-T E.999', 'itu-t-e-999'],
      ['CC/WD 51015', 'cc-wd-51015']
    ] as const)('normalizes "%s" to "%s"', (input, expected) => {
      const id = DocumentId.fromRaw(input);
      expect(id.toString()).toBe(expected);
    });

    it('throws on empty string', () => {
      expect(() => DocumentId.fromRaw('')).toThrow(
        'Cannot normalize identifier'
      );
    });

    it('throws on whitespace-only', () => {
      expect(() => DocumentId.fromRaw('   ')).toThrow(
        'Cannot normalize identifier'
      );
    });

    it('is idempotent', () => {
      const raw = 'CC 51015';
      const first = DocumentId.fromRaw(raw);
      const second = DocumentId.fromRaw(first.toString());
      expect(first.equals(second)).toBe(true);
    });

    it('equals is case-insensitive through normalization', () => {
      const upper = DocumentId.fromRaw('CC 51015');
      const lower = DocumentId.fromRaw('cc 51015');
      expect(upper.equals(lower)).toBe(true);
    });
  });

  describe('properties', () => {
    it('tagPrefix returns normalized value', () => {
      const id = DocumentId.fromRaw('CC 51015');
      expect(id.tagPrefix).toBe('cc-51015');
    });

    it('fileName returns normalized value', () => {
      const id = DocumentId.fromRaw('CC 51015');
      expect(id.fileName).toBe('cc-51015');
    });
  });
});
