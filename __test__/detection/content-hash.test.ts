import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { computeContentHash } from '../../src/detection/content-hash.js';
import { ContentHash } from '../../src/domain/types.js';

describe('ContentHash', () => {
  describe('ContentHash.fromString', () => {
    it('creates hash from string', () => {
      const hash = ContentHash.fromString('abc123');
      expect(hash.toString()).toBe('abc123');
    });

    it('equality check', () => {
      const a = ContentHash.fromString('abc123');
      const b = ContentHash.fromString('abc123');
      const c = ContentHash.fromString('def456');
      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });
  });

  describe('computeContentHash', () => {
    const tmpDir = join(__dirname, 'tmp-hash-test');

    beforeEach(async () => {
      await mkdir(tmpDir, { recursive: true });
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('returns same hash for same content', async () => {
      await writeFile(join(tmpDir, 'test.html'), '<html>hello</html>');
      const a = await computeContentHash(tmpDir);
      const b = await computeContentHash(tmpDir);
      expect(a.equals(b)).toBe(true);
    });

    it('returns different hash when content changes', async () => {
      await writeFile(join(tmpDir, 'test.html'), '<html>hello</html>');
      const a = await computeContentHash(tmpDir);

      await writeFile(join(tmpDir, 'test.html'), '<html>world</html>');
      const b = await computeContentHash(tmpDir);
      expect(a.equals(b)).toBe(false);
    });

    it('is deterministic regardless of file order', async () => {
      await writeFile(join(tmpDir, 'a.html'), 'aaa');
      await writeFile(join(tmpDir, 'b.html'), 'bbb');
      const a = await computeContentHash(tmpDir);

      await rm(join(tmpDir, 'a.html'));
      await rm(join(tmpDir, 'b.html'));
      await writeFile(join(tmpDir, 'b.html'), 'bbb');
      await writeFile(join(tmpDir, 'a.html'), 'aaa');
      const b = await computeContentHash(tmpDir);

      expect(a.equals(b)).toBe(true);
    });

    it('handles empty directory', async () => {
      const hash = await computeContentHash(tmpDir);
      expect(hash.toString()).toBeTruthy();
    });

    it('excludes .hash files', async () => {
      await writeFile(join(tmpDir, 'test.html'), 'content');
      await writeFile(join(tmpDir, 'test.hash'), 'hash-data');
      const a = await computeContentHash(tmpDir);

      await rm(join(tmpDir, 'test.hash'));
      const b = await computeContentHash(tmpDir);
      expect(a.equals(b)).toBe(true);
    });
  });
});
