import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  RxlExtractor,
  discoverDocuments
} from '../../src/extractors/rxl-extractor.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';

describe('discoverDocuments', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(__dirname, 'tmp-discover');
    await mkdir(tmpDir, { recursive: true });
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

    const results = await discoverDocuments(tmpDir, new RxlExtractor());
    expect(results.length).toBe(1);
    expect(results[0].id.toString()).toBe('cc-51015');
  });

  it('returns empty array when no RXL files found', async () => {
    await writeFile(join(tmpDir, 'readme.txt'), 'not an rxl');

    const results = await discoverDocuments(tmpDir, new RxlExtractor());
    expect(results).toEqual([]);
  });

  it('skips malformed RXL files without failing', async () => {
    const subDir = join(tmpDir, 'bad-doc');
    await mkdir(subDir, { recursive: true });
    await writeFile(join(subDir, 'bad.rxl'), '<not-valid-bibdata>');

    const goodDir = join(tmpDir, 'good-doc');
    await mkdir(goodDir, { recursive: true });
    await writeFile(join(goodDir, 'good.rxl'), VALID_RXL);

    const results = await discoverDocuments(tmpDir, new RxlExtractor());
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

    const results = await discoverDocuments(tmpDir, new RxlExtractor());
    expect(results.length).toBe(2);
  });
});
