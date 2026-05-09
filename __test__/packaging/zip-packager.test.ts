import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ZipPackager } from '../../src/packaging/zip-packager.js';
import {
  DocumentId,
  DocumentVersion,
  DocumentStage
} from '../../src/domain/types.js';
import { DocumentType } from '../../src/domain/document-metadata.js';
import { createDefaultRegistry } from '../../src/packaging/naming-strategy.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import type { DocumentMetadata } from '../../src/domain/document-metadata.js';

function makeDoc(overrides: Partial<DocumentMetadata> = {}): DocumentMetadata {
  return {
    id: DocumentId.fromRaw('cc-51015'),
    title: 'Test Document',
    version: DocumentVersion.from('1', DocumentStage.fromStatus('published')),
    doctype: 'standard',
    documentType: DocumentType.Standard,
    flavor: undefined,
    revdate: undefined,
    sourcePath: 'sources/cc-51015.adoc',
    outputDir: '',
    formats: ['html', 'pdf'],
    ...overrides
  };
}

async function readZipEntries(zipPath: string): Promise<string[]> {
  const entries: string[] = [];
  const { default: AdmZip } = await import('adm-zip');
  const zip = new AdmZip(zipPath);
  for (const entry of zip.getEntries()) {
    if (!entry.isDirectory) {
      entries.push(entry.entryName);
    }
  }
  return entries.sort();
}

describe('ZipPackager', () => {
  let packager: ZipPackager;
  let tmpDir: string;

  beforeEach(async () => {
    packager = new ZipPackager(createDefaultRegistry());
    tmpDir = join(__dirname, 'tmp-zip-test');
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates a zip with canonical filenames', async () => {
    const outputDir = join(tmpDir, 'output');
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'cc-51015.html'), '<html/>');
    await writeFile(join(outputDir, 'cc-51015.pdf'), 'pdf');

    const doc = makeDoc({ outputDir });
    const result = await packager.package(doc, doc.version);

    expect(result.zipPath).toContain('mn-release-');
    expect(result.zipSize).toBeGreaterThan(0);

    const entries = await readZipEntries(result.zipPath);
    expect(entries).toContain('cc-51015-ed1.html');
    expect(entries).toContain('cc-51015-ed1.pdf');
  });

  it('uses draft suffix in canonical names for working draft', async () => {
    const outputDir = join(tmpDir, 'output');
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'cc-51015.html'), '<html/>');

    const doc = makeDoc({
      outputDir,
      version: DocumentVersion.from(
        '2',
        DocumentStage.fromStatus('working-draft')
      )
    });
    const result = await packager.package(doc, doc.version);

    const entries = await readZipEntries(result.zipPath);
    expect(entries).toContain('cc-51015-ed2-wd.html');
  });

  it('handles directories with subdirectories', async () => {
    const outputDir = join(tmpDir, 'output');
    const subDir = join(outputDir, 'subdir');
    await mkdir(subDir, { recursive: true });
    await writeFile(join(outputDir, 'root.html'), '<html/>');
    await writeFile(join(subDir, 'nested.pdf'), 'pdf');

    const doc = makeDoc({ outputDir });
    const result = await packager.package(doc, doc.version);

    const entries = await readZipEntries(result.zipPath);
    expect(entries.length).toBeGreaterThan(0);
  });

  it('skips empty extensions', async () => {
    const outputDir = join(tmpDir, 'output');
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'Makefile'), 'all:');
    await writeFile(join(outputDir, 'doc.html'), '<html/>');

    const doc = makeDoc({ outputDir });
    const result = await packager.package(doc, doc.version);

    const entries = await readZipEntries(result.zipPath);
    expect(entries).toContain('cc-51015-ed1.html');
  });
});
