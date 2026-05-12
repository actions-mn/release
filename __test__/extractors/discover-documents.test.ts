import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RxlExtractor } from '../../src/extractors/rxl-extractor.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';

describe('RxlExtractor.discover', () => {
  let tmpDir: string;
  let extractor: RxlExtractor;

  beforeEach(async () => {
    tmpDir = join(__dirname, 'tmp-discover');
    await mkdir(tmpDir, { recursive: true });
    extractor = new RxlExtractor();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  const VALID_RXL = `<?xml version="1.0" encoding="UTF-8"?>
<bibdata type="standard">
  <docidentifier type="ISO" primary="true">CC 51015</docidentifier>
  <title language="en" type="main">Test Doc</title>
  <edition>1</edition>
  <status><stage>published</stage></status>
  <doctype>standard</doctype>
</bibdata>`;

  it('discovers RXL files in nested directories', async () => {
    const subDir = join(tmpDir, 'documents', 'cc-51015');
    await mkdir(subDir, { recursive: true });
    await writeFile(
      join(subDir, 'presentation.xml'),
      VALID_RXL.replace('presentation.xml', 'document.rxl')
    );
    await writeFile(join(subDir, 'document.rxl'), VALID_RXL);

    const results = await extractor.discover(tmpDir);
    expect(results.length).toBe(1);
    expect(results[0].id.toString()).toBe('cc-51015');
  });

  it('returns empty array when no RXL files found', async () => {
    await writeFile(join(tmpDir, 'readme.txt'), 'not an rxl');

    const results = await extractor.discover(tmpDir);
    expect(results).toEqual([]);
  });

  it('skips malformed RXL files without failing', async () => {
    const subDir = join(tmpDir, 'bad-doc');
    await mkdir(subDir, { recursive: true });
    await writeFile(join(subDir, 'bad.rxl'), '<not-valid-bibdata>');

    const goodDir = join(tmpDir, 'good-doc');
    await mkdir(goodDir, { recursive: true });
    await writeFile(join(goodDir, 'good.rxl'), VALID_RXL);

    const results = await extractor.discover(tmpDir);
    expect(results.length).toBe(1);
    expect(results[0].id.toString()).toBe('cc-51015');
  });

  it('handles multiple RXL files', async () => {
    for (const name of ['cc-51015', 'cc-51024']) {
      const dir = join(tmpDir, name);
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, 'document.rxl'),
        VALID_RXL.replace(
          'CC 51015',
          `CC ${name === 'cc-51015' ? '51015' : '51024'}`
        )
      );
    }

    const results = await extractor.discover(tmpDir);
    expect(results.length).toBe(2);
  });

  describe('failure threshold', () => {
    it('throws when failure ratio exceeds default 50% threshold', async () => {
      extractor = new RxlExtractor();
      // 3 bad, 1 good = 75% failures, above 50% default
      for (const name of ['bad1', 'bad2', 'bad3']) {
        const dir = join(tmpDir, name);
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, 'doc.rxl'), '<not-valid-bibdata>');
      }
      const goodDir = join(tmpDir, 'good');
      await mkdir(goodDir, { recursive: true });
      await writeFile(join(goodDir, 'doc.rxl'), VALID_RXL);

      await expect(extractor.discover(tmpDir)).rejects.toThrow(
        /Too many RXL extraction failures.*3\/4.*75%/
      );
    });

    it('does not throw when failures are below threshold', async () => {
      extractor = new RxlExtractor();
      // 1 bad, 3 good = 25% failures, below 50%
      const badDir = join(tmpDir, 'bad');
      await mkdir(badDir, { recursive: true });
      await writeFile(join(badDir, 'doc.rxl'), '<not-valid-bibdata>');

      for (const name of ['good1', 'good2', 'good3']) {
        const dir = join(tmpDir, name);
        await mkdir(dir, { recursive: true });
        await writeFile(
          join(dir, 'doc.rxl'),
          VALID_RXL.replace(
            'CC 51015',
            `CC ${name === 'good1' ? '51015' : name === 'good2' ? '51024' : '51026'}`
          )
        );
      }

      const results = await extractor.discover(tmpDir);
      expect(results).toHaveLength(3);
    });

    it('respects custom failure threshold', async () => {
      extractor = new RxlExtractor(0.9);
      // 3 bad, 1 good = 75%, below 90% threshold
      for (const name of ['bad1', 'bad2', 'bad3']) {
        const dir = join(tmpDir, name);
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, 'doc.rxl'), '<not-valid-bibdata>');
      }
      const goodDir = join(tmpDir, 'good');
      await mkdir(goodDir, { recursive: true });
      await writeFile(join(goodDir, 'doc.rxl'), VALID_RXL);

      const results = await extractor.discover(tmpDir);
      expect(results).toHaveLength(1);
    });

    it('does not throw when all files fail but threshold is 1.0', async () => {
      extractor = new RxlExtractor(1.0);
      const dir = join(tmpDir, 'bad');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'doc.rxl'), '<not-valid-bibdata>');

      const results = await extractor.discover(tmpDir);
      expect(results).toHaveLength(0);
    });

    it('does not throw for empty directory regardless of threshold', async () => {
      extractor = new RxlExtractor(0);
      await writeFile(join(tmpDir, 'readme.txt'), 'not an rxl');

      const results = await extractor.discover(tmpDir);
      expect(results).toEqual([]);
    });
  });
});
