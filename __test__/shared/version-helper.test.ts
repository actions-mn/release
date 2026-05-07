import { describe, it, expect } from 'vitest';
import {
  Version,
  MINIMUM_MODERN_VERSION
} from '../../src/shared/version-helper.js';

describe('Version', () => {
  describe('parse', () => {
    it('parses valid version', () => {
      expect(Version.parse('1.10.0').toString()).toBe('1.10.0');
    });

    it('throws on invalid format', () => {
      expect(() => Version.parse('invalid')).toThrow('Invalid version format');
      expect(() => Version.parse('1.2')).toThrow('Invalid version format');
    });
  });

  describe('gte', () => {
    it('equal versions', () => {
      expect(Version.parse('1.10.0').gte(Version.parse('1.10.0'))).toBe(true);
    });

    it('major comparison', () => {
      expect(Version.parse('2.0.0').gte(Version.parse('1.0.0'))).toBe(true);
      expect(Version.parse('1.0.0').gte(Version.parse('2.0.0'))).toBe(false);
    });

    it('minor comparison', () => {
      expect(Version.parse('1.10.0').gte(Version.parse('1.9.0'))).toBe(true);
      expect(Version.parse('1.9.0').gte(Version.parse('1.10.0'))).toBe(false);
    });

    it('minimum modern version check', () => {
      expect(Version.parse('1.10.0').gte(MINIMUM_MODERN_VERSION)).toBe(true);
      expect(Version.parse('1.9.9').gte(MINIMUM_MODERN_VERSION)).toBe(false);
    });
  });

  describe('lt', () => {
    it('less than', () => {
      expect(Version.parse('1.9.0').lt(Version.parse('1.10.0'))).toBe(true);
    });

    it('not less than equal', () => {
      expect(Version.parse('1.10.0').lt(Version.parse('1.10.0'))).toBe(false);
    });
  });
});
