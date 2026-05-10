import { describe, it, expect, beforeEach } from 'vitest';
import { RxlExtractor } from '../../src/extractors/rxl-extractor.js';
import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';

const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'rxl');

describe('RxlExtractor', () => {
  let extractor: RxlExtractor;

  beforeEach(() => {
    extractor = new RxlExtractor();
  });

  describe('extract — real fixtures from Metanorma sample sites', () => {
    it('extracts CC/FDS 18011:2018 (final-draft)', async () => {
      const result = await extractor.extract(
        join(FIXTURES_DIR, 'cc-18011.rxl')
      );
      expect(result.id.toString()).toBe('cc-fds-18011-2018');
      expect(result.title).toContain('Explicit representation');
      expect(result.version.editionNumber).toBe('1');
      expect(result.version.tagComponent).toBe('ed1-fd');
      expect(result.version.isPreRelease).toBe(true);
      expect(result.flavor).toBe('cc');
      expect(result.revdate).toContain('2018');
    });

    it('extracts ISO 17301-1:2016 (published, stage 60.60)', async () => {
      const result = await extractor.extract(
        join(FIXTURES_DIR, 'iso-rice-published.rxl')
      );
      expect(result.id.toString()).toBe('iso-17301-1-2016');
      expect(result.version.isPreRelease).toBe(false);
      expect(result.version.editionNumber).toBe('2');
      expect(result.flavor).toBe('iso');
    });

    it('extracts ISO/AWI 17301-1:2016 (WD, stage 20.00)', async () => {
      const result = await extractor.extract(
        join(FIXTURES_DIR, 'iso-rice-wd.rxl')
      );
      expect(result.id.toString()).toBe('iso-awi-17301-1-2016');
      expect(result.version.tagComponent).toBe('ed2-20.00');
      expect(result.version.isPreRelease).toBe(true);
      expect(result.flavor).toBe('iso');
    });

    it('extracts ISO/CD 17301-1:2016 (CD, stage 30.00)', async () => {
      const result = await extractor.extract(
        join(FIXTURES_DIR, 'iso-rice-cd.rxl')
      );
      expect(result.id.toString()).toBe('iso-cd-17301-1-2016');
      expect(result.version.tagComponent).toBe('ed2-30.00');
      expect(result.version.isPreRelease).toBe(true);
      expect(result.flavor).toBe('iso');
    });

    it('extracts draft-camelot-holy-grenade-01 (IETF I-D)', async () => {
      const result = await extractor.extract(
        join(FIXTURES_DIR, 'ietf-antioch.rxl')
      );
      expect(result.id.toString()).toBe('draft-camelot-holy-grenade-01');
      expect(result.documentType).toBe('ietf-draft');
      expect(result.flavor).toBe('ietf');
      expect(result.title).toContain('Holy Hand Grenade');
    });

    it('extracts IETF RFC 1149 document', async () => {
      const result = await extractor.extract(
        join(FIXTURES_DIR, 'ietf-example.rxl')
      );
      expect(result.id.toString()).toBe('1149');
      expect(result.documentType).toBe('standard');
      expect(result.flavor).toBe('ietf');
    });

    it('extracts OGC 10-091r3 (approved)', async () => {
      const result = await extractor.extract(
        join(FIXTURES_DIR, 'ogc-10-091r3.rxl')
      );
      expect(result.id.toString()).toBe('10-091r3');
      expect(result.version.isPreRelease).toBe(false);
      expect(result.flavor).toBe('ogc');
      expect(result.revdate).toBe('2011-04-05');
    });

    it('extracts IHO S-102 (in-force)', async () => {
      const result = await extractor.extract(
        join(FIXTURES_DIR, 'iho-s102.rxl')
      );
      expect(result.id.toString()).toBe('s-102');
      expect(result.version.isPreRelease).toBe(false);
      expect(result.version.editionNumber).toBe('2.1.0');
      expect(result.flavor).toBe('iho');
    });

    it('extracts BIPM brochure (in-force)', async () => {
      const result = await extractor.extract(
        join(FIXTURES_DIR, 'bipm-brochure.rxl')
      );
      expect(result.id.toString()).toBe('bipm-its-90-mep-1-a1');
      expect(result.version.isPreRelease).toBe(false);
      expect(result.flavor).toBe('bipm');
    });

    it('extracts BIPM WPN 203 (in-force)', async () => {
      const result = await extractor.extract(
        join(FIXTURES_DIR, 'bipm-wpn.rxl')
      );
      expect(result.id.toString()).toBe('bipm-203');
      expect(result.version.isPreRelease).toBe(false);
      expect(result.flavor).toBe('bipm');
    });

    it('throws on malformed XML', async () => {
      await expect(
        extractor.extract(join(FIXTURES_DIR, 'malformed.rxl'))
      ).rejects.toThrow();
    });
  });

  describe('document type detection', () => {
    it('detects standard for CC document', async () => {
      const result = await extractor.extract(
        join(FIXTURES_DIR, 'cc-18011.rxl')
      );
      expect(result.documentType).toBe('standard');
    });

    it('detects ietf-draft for draft- identifier', async () => {
      const result = await extractor.extract(
        join(FIXTURES_DIR, 'ietf-antioch.rxl')
      );
      expect(result.documentType).toBe('ietf-draft');
    });
  });

  describe('detects formats in output directory', () => {
    it('lists file extensions excluding .rxl', async () => {
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
