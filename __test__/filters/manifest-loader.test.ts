import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadManifest } from '../../src/filters/manifest-loader.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';

function mockDoc(sourcePath: string, id: string) {
  return { sourcePath, id: { toString: () => id } };
}

describe('manifest-loader', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(__dirname, 'tmp-manifest-test');
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('loads valid manifest with documents', async () => {
    await writeFile(
      join(tmpDir, 'manifest.yml'),
      `documents:
  - source: sources/cc-51015.adoc
  - source: sources/cc-51026.adoc
    visibility: private`
    );

    const manifest = await loadManifest(tmpDir, 'manifest.yml');
    expect(
      manifest.resolve(mockDoc('sources/cc-51015.adoc', 'cc-51015'))
        .shouldRelease
    ).toBe(true);
    expect(
      manifest.resolve(mockDoc('sources/cc-51026.adoc', 'cc-51026'))
        .shouldRelease
    ).toBe(false);
  });

  it('returns allPublic when file does not exist', async () => {
    const manifest = await loadManifest(tmpDir, 'nonexistent.yml');
    expect(
      manifest.resolve(mockDoc('any/path.adoc', 'cc-1')).shouldRelease
    ).toBe(true);
  });

  it('returns allPrivate for empty manifest', async () => {
    await writeFile(join(tmpDir, 'empty.yml'), '{}');

    const manifest = await loadManifest(tmpDir, 'empty.yml');
    expect(
      manifest.resolve(mockDoc('any/path.adoc', 'cc-1')).shouldRelease
    ).toBe(false);
    expect(manifest.listAll()).toEqual([]);
  });

  it('throws on invalid YAML that is not ENOENT', async () => {
    await writeFile(
      join(tmpDir, 'bad.yml'),
      `documents:
  - source: valid.adoc
    - broken: true
      nested: [invalid`
    );

    await expect(loadManifest(tmpDir, 'bad.yml')).rejects.toThrow();
  });

  it('handles manifest with no documents key', async () => {
    await writeFile(join(tmpDir, 'nodoc.yml'), `other: value`);

    const manifest = await loadManifest(tmpDir, 'nodoc.yml');
    expect(
      manifest.resolve(mockDoc('any/path.adoc', 'cc-1')).shouldRelease
    ).toBe(false);
  });
});
