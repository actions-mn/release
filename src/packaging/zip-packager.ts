import { createWriteStream } from 'fs';
import { stat } from 'fs/promises';
import { tmpdir } from 'os';
import { extname, join } from 'path';
import archiver from 'archiver';
import type { IArtifactPackager } from '../domain/types.js';
import type { ArtifactResult, DocumentVersion } from '../domain/types.js';
import type { DocumentMetadata } from '../domain/document-metadata.js';
import type { NamingStrategyRegistry } from './naming-strategy.js';

export class ZipPackager implements IArtifactPackager {
  constructor(private readonly namingRegistry: NamingStrategyRegistry) {}

  async package(
    metadata: DocumentMetadata,
    _version: DocumentVersion
  ): Promise<ArtifactResult> {
    const strategy = this.namingRegistry.resolve(metadata.documentType);
    const assetName = strategy.computeAssetName(metadata.id, metadata.version);
    const canonicalBase = strategy.computeCanonicalBase(
      metadata.id,
      metadata.version
    );
    const zipPath = join(tmpdir(), `mn-release-${assetName}`);

    await this.createZipWithCanonicalNames(
      metadata.outputDir,
      zipPath,
      canonicalBase
    );

    const stats = await stat(zipPath);
    return { zipPath, zipSize: stats.size };
  }

  private async createZipWithCanonicalNames(
    sourceDir: string,
    outputPath: string,
    canonicalBase: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      archive.directory(sourceDir, false, (entry) => {
        const ext = extname(entry.name);
        if (ext && entry.stats && !entry.stats.isDirectory()) {
          entry.name = `${canonicalBase}${ext}`;
        }
        return entry;
      });
      archive.finalize();
    });
  }
}
