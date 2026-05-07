import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RxlExtractor } from '../../src/extractors/rxl-extractor.js';
import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';

const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'rxl');

describe('RxlExtractor', () => {
  let extractor: RxlExtractor;

  beforeEach(() => {
    extractor = new RxlExtractor();
  });

  describe('extract', () => {
    it('extracts CC published document', async () => {
      const result = await extractor.extract(
        join(FIXTURES_DIR, 'cc-published.rxl')
      );
      expect(result.id.toString()).toBe('cc-51015');
      expect(result.title).toBe(
        'JSCalendar: A JSON Representation of Calendar Data'
      );
      expect(result.version.editionNumber).toBe('1');
      expect(result.version.isPreRelease).toBe(false);
      expect(result.doctype).toBe('standard');
      expect(result.revdate).toBe('2019-01-18');
    });

    it('extracts CC working draft', async () => {
      const result = await extractor.extract(
        join(FIXTURES_DIR, 'cc-working-draft.rxl')
      );
      expect(result.id.toString()).toBe('cc-51015');
      expect(result.version.tagComponent).toBe('ed2-wd');
      expect(result.version.isPreRelease).toBe(true);
    });

    it('extracts CC committee draft', async () => {
      const result = await extractor.extract(
        join(FIXTURES_DIR, 'cc-committee-draft.rxl')
      );
      expect(result.id.toString()).toBe('cc-51024');
      expect(result.version.tagComponent).toBe('ed1-cd');
    });

    it('extracts ISO published (60.60)', async () => {
      const result = await extractor.extract(
        join(FIXTURES_DIR, 'iso-published.rxl')
      );
      expect(result.id.toString()).toBe('iso-8601-1-2019');
      expect(result.version.isPreRelease).toBe(false);
      expect(result.version.editionNumber).toBe('1');
    });

    it('extracts ISO WD (20.20)', async () => {
      const result = await extractor.extract(join(FIXTURES_DIR, 'iso-wd.rxl'));
      expect(result.id.toString()).toBe('iso-wd-8601-1-2026');
      expect(result.version.tagComponent).toBe('ed2-wd');
      expect(result.version.isPreRelease).toBe(true);
    });

    it('extracts IETF I-D', async () => {
      const result = await extractor.extract(join(FIXTURES_DIR, 'ietf-id.rxl'));
      expect(result.id.toString()).toBe('draft-ietf-calext-jscalendar-32');
    });

    it('extracts IETF RFC', async () => {
      const result = await extractor.extract(
        join(FIXTURES_DIR, 'ietf-rfc.rxl')
      );
      expect(result.id.toString()).toBe('rfc-8984');
    });

    it('throws on malformed XML', async () => {
      await expect(
        extractor.extract(join(FIXTURES_DIR, 'malformed.rxl'))
      ).rejects.toThrow();
    });

    it('detects document type correctly', async () => {
      const cc = await extractor.extract(
        join(FIXTURES_DIR, 'cc-published.rxl')
      );
      expect(cc.documentType).toBe('standard');

      const id = await extractor.extract(join(FIXTURES_DIR, 'ietf-id.rxl'));
      expect(id.documentType).toBe('ietf-draft');

      const rfc = await extractor.extract(join(FIXTURES_DIR, 'ietf-rfc.rxl'));
      expect(rfc.documentType).toBe('ietf-rfc');
    });

    it('detects formats in output directory', async () => {
      const tmpDir = join(__dirname, 'tmp-format-detect');
      try {
        await mkdir(tmpDir, { recursive: true });
        await writeFile(join(tmpDir, 'document.html'), '<html/>');
        await writeFile(join(tmpDir, 'document.pdf'), 'pdf');
        await writeFile(join(tmpDir, 'document.rxl'), '<bibdata/>');

        const rxlContent = `<?xml version="1.0" encoding="UTF-8"?>
<bibdata type="standard">
  <docidentifier type="ISO" primary="true">CC 51015</docidentifier>
  <title language="en" type="main">Test</title>
  <edition>1</edition>
  <status><stage>published</stage></status>
  <doctype>standard</doctype>
</bibdata>`;
        const rxlPath = join(tmpDir, 'document.rxl');
        await writeFile(rxlPath, rxlContent);

        const result = await extractor.extract(rxlPath);
        expect(result.formats).toContain('html');
        expect(result.formats).toContain('pdf');
        expect(result.formats).not.toContain('rxl');
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
