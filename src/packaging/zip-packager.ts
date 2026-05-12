import { createWriteStream } from 'fs';
import { stat } from 'fs/promises';
import { tmpdir } from 'os';
import { extname, join } from 'path';
import archiver from 'archiver';
import type { IArtifactPackager, ArtifactResult } from '../domain/types.js';
import type { DocumentMetadata } from '../domain/document-metadata.js';

export class ZipPackager implements IArtifactPackager {
  async package(
    metadata: DocumentMetadata,
    canonicalBase: string
  ): Promise<ArtifactResult> {
    const assetName = `${canonicalBase}.zip`;
    const zipPath = join(tmpdir(), `mn-release-${Date.now()}-${assetName}`);

    await this.createZipWithCanonicalNames(
      metadata.outputDir,
      zipPath,
      canonicalBase,
      metadata.fileBaseName
    );

    const stats = await stat(zipPath);
    return { zipPath, zipSize: stats.size, assetName };
  }

  private async createZipWithCanonicalNames(
    sourceDir: string,
    outputPath: string,
    canonicalBase: string,
    docIdPrefix: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      archive.directory(sourceDir, false, (entry) => {
        const ext = extname(entry.name);
        if (!ext || !entry.stats || entry.stats.isDirectory()) {
          return false;
        }
        const baseName = entry.name.replace(/\.[^.]+$/, '');
        if (baseName !== docIdPrefix) {
          return false;
        }
        entry.name = `${canonicalBase}${ext}`;
        return entry;
      });
      archive.finalize();
    });
  }
}
