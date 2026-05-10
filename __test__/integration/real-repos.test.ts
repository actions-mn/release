import { describe, it, expect } from 'vitest';
import { RxlExtractor } from '../../src/extractors/rxl-extractor.js';
import { createDefaultRegistry } from '../../src/packaging/naming-strategy.js';
import { existsSync } from 'fs';
import { join } from 'path';

const REPOS_DIR = '/Users/mulgogi/src/calconnect';

interface ExpectedResult {
  repo: string;
  rxlFile: string;
  rawId: string;
  tag: string;
  asset: string;
  preRelease: boolean;
  strategyName: string;
}

function repoPath(repo: string): string {
  return join(REPOS_DIR, repo);
}

function skipIfMissing(repo: string): boolean {
  return !existsSync(join(REPOS_DIR, repo, 'documents'));
}

const extractor = new RxlExtractor();
const registry = createDefaultRegistry();

describe('Real repo integration', () => {
  describe('csd-directive-document-requirements', () => {
    const repo = 'csd-directive-document-requirements';

    it('extracts and names CC/DIR published document', async () => {
      if (skipIfMissing(repo)) return;
      const rxlPath = join(REPOS_DIR, repo, 'documents', 'cc-10002.rxl');
      if (!existsSync(rxlPath)) return;

      const metadata = await extractor.extract(rxlPath);
      const strategy = registry.resolve(metadata.documentType);
      const tag = strategy.computeTag(metadata.id, metadata.version);
      const asset = strategy.computeAssetName(metadata.id, metadata.version);

      expect(metadata.id.toString()).toBe('cc-dir-10002-2019');
      expect(metadata.documentType).toBe('standard');
      expect(metadata.version.tagComponent).toBe('ed1');
      expect(tag.toString()).toBe('cc-dir-10002-2019/ed1');
      expect(tag.isPreRelease).toBe(false);
      expect(asset).toBe('cc-dir-10002-2019-ed1.zip');
      expect(strategy.constructor.name).toBe('EditionNamingStrategy');
    });
  });

  describe('csd-calspam-bcp', () => {
    const repo = 'csd-calspam-bcp';

    it('extracts and names CC/R published report', async () => {
      if (skipIfMissing(repo)) return;
      const rxlPath = join(REPOS_DIR, repo, 'documents', 'cc-18003.rxl');
      if (!existsSync(rxlPath)) return;

      const metadata = await extractor.extract(rxlPath);
      const strategy = registry.resolve(metadata.documentType);
      const tag = strategy.computeTag(metadata.id, metadata.version);
      const asset = strategy.computeAssetName(metadata.id, metadata.version);

      expect(metadata.id.toString()).toBe('cc-r-18003-2019');
      expect(metadata.documentType).toBe('standard');
      expect(metadata.version.tagComponent).toBe('ed1');
      expect(tag.toString()).toBe('cc-r-18003-2019/ed1');
      expect(tag.isPreRelease).toBe(false);
      expect(asset).toBe('cc-r-18003-2019-ed1.zip');
    });
  });

  describe('csd-icalendar-series', () => {
    const repo = 'csd-icalendar-series';

    it('extracts and names CC/CD committee draft', async () => {
      if (skipIfMissing(repo)) return;
      const rxlPath = join(REPOS_DIR, repo, 'documents', 'cc-51003.rxl');
      if (!existsSync(rxlPath)) return;

      const metadata = await extractor.extract(rxlPath);
      const strategy = registry.resolve(metadata.documentType);
      const tag = strategy.computeTag(metadata.id, metadata.version);
      const asset = strategy.computeAssetName(metadata.id, metadata.version);

      expect(metadata.id.toString()).toBe('cc-cd-51003-2018');
      expect(metadata.documentType).toBe('standard');
      expect(metadata.version.tagComponent).toBe('ed1-cd');
      expect(tag.toString()).toBe('cc-cd-51003-2018/ed1-cd');
      expect(tag.isPreRelease).toBe(true);
      expect(asset).toBe('cc-cd-51003-2018-ed1-cd.zip');
    });

    it('handles IETF draft with missing docidentifier', async () => {
      if (skipIfMissing(repo)) return;
      const rxlPath = join(
        REPOS_DIR,
        repo,
        'documents',
        'draft-ietf-calext-icalendar-series.rxl'
      );
      if (!existsSync(rxlPath)) return;

      await expect(extractor.extract(rxlPath)).rejects.toThrow(
        'No docidentifier'
      );
    });
  });

  describe('csd-standard-doc', () => {
    const repo = 'csd-standard-doc';

    it('extracts and names CC/WD working draft', async () => {
      if (skipIfMissing(repo)) return;
      const rxlPath = join(REPOS_DIR, repo, 'documents', 'cc-36100.rxl');
      if (!existsSync(rxlPath)) return;

      const metadata = await extractor.extract(rxlPath);
      const strategy = registry.resolve(metadata.documentType);
      const tag = strategy.computeTag(metadata.id, metadata.version);
      const asset = strategy.computeAssetName(metadata.id, metadata.version);

      expect(metadata.id.toString()).toBe('cc-wd-36100-2020');
      expect(metadata.documentType).toBe('standard');
      expect(metadata.version.tagComponent).toBe('ed1-wd');
      expect(tag.toString()).toBe('cc-wd-36100-2020/ed1-wd');
      expect(tag.isPreRelease).toBe(true);
      expect(asset).toBe('cc-wd-36100-2020-ed1-wd.zip');
    });

    it('extracts and names ISO/WD document', async () => {
      if (skipIfMissing(repo)) return;
      const rxlPath = join(REPOS_DIR, repo, 'documents', 'iso-36100.rxl');
      if (!existsSync(rxlPath)) return;

      const metadata = await extractor.extract(rxlPath);
      const strategy = registry.resolve(metadata.documentType);
      const tag = strategy.computeTag(metadata.id, metadata.version);
      const asset = strategy.computeAssetName(metadata.id, metadata.version);

      expect(metadata.id.toString()).toBe('iso-wd-36100');
      expect(metadata.documentType).toBe('iso');
      expect(metadata.version.tagComponent).toBe('ed1-20.00');
      expect(tag.toString()).toBe('iso-wd-36100/ed1-20.00');
      expect(asset).toBe('iso-wd-36100-ed1-20.00.zip');
      expect(strategy.constructor.name).toBe('EditionNamingStrategy');
    });
  });

  describe('csd-iso-psdo-agreement', () => {
    const repo = 'csd-iso-psdo-agreement';

    it('extracts and names CC/FDS final draft', async () => {
      if (skipIfMissing(repo)) return;
      const rxlPath = join(REPOS_DIR, repo, 'documents', 'cc-10010.rxl');
      if (!existsSync(rxlPath)) return;

      const metadata = await extractor.extract(rxlPath);
      const strategy = registry.resolve(metadata.documentType);
      const tag = strategy.computeTag(metadata.id, metadata.version);
      const asset = strategy.computeAssetName(metadata.id, metadata.version);

      expect(metadata.id.toString()).toBe('cc-fds-10010-2019');
      expect(metadata.version.tagComponent).toBe('ed1-fd');
      expect(tag.toString()).toBe('cc-fds-10010-2019/ed1-fd');
      expect(tag.isPreRelease).toBe(true);
      expect(asset).toBe('cc-fds-10010-2019-ed1-fd.zip');
    });
  });
});
