import { describe, it, expect } from 'vitest';
import { validatePath, validateFilename } from '../src/input-helper.js';

describe('Input Validation', () => {
  describe('validatePath', () => {
    it('accepts relative paths', () => {
      expect(validatePath('.', 'source-path')).toBe('.');
      expect(validatePath('docs', 'source-path')).toBe('docs');
    });

    it('rejects path traversal', () => {
      expect(() => validatePath('../etc', 'source-path')).toThrow(
        'Path traversal detected'
      );
      expect(() => validatePath('foo/../bar', 'source-path')).toThrow(
        'Path traversal detected'
      );
    });

    it('rejects absolute paths outside workspace', () => {
      expect(() => validatePath('/etc/passwd', 'source-path')).toThrow(
        'Absolute path not allowed'
      );
    });

    it('accepts workspace absolute paths', () => {
      expect(() =>
        validatePath('/github/workspace/repo', 'source-path')
      ).not.toThrow();
    });

    it('rejects paths exceeding max length', () => {
      expect(() => validatePath('a'.repeat(256), 'source-path')).toThrow(
        'Path too long'
      );
    });
  });

  describe('validateFilename', () => {
    it('accepts valid filenames', () => {
      expect(() =>
        validateFilename('metanorma.yml', 'config-file')
      ).not.toThrow();
      expect(() =>
        validateFilename('metanorma.release.yml', 'config-file')
      ).not.toThrow();
    });

    it('rejects filenames with invalid characters', () => {
      expect(() => validateFilename('config file.yml', 'config-file')).toThrow(
        'Invalid characters'
      );
      expect(() => validateFilename('config;ls', 'config-file')).toThrow(
        'Invalid characters'
      );
    });

    it('rejects filenames exceeding max length', () => {
      expect(() =>
        validateFilename('a'.repeat(101) + '.yml', 'config-file')
      ).toThrow('Filename too long');
    });
  });
});
