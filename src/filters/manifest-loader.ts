import { readFile } from 'fs/promises';
import { join } from 'path';
import * as yaml from 'js-yaml';
import { ReleaseManifest } from '../domain/release-manifest.js';
import { logger } from '../shared/logger.js';

export async function loadManifest(
  sourcePath: string,
  fileName: string,
  defaultVisibility: 'public' | 'private' = 'public'
): Promise<ReleaseManifest> {
  const filePath = join(sourcePath, fileName);

  try {
    const content = await readFile(filePath, 'utf-8');
    const parsed = yaml.load(content) as {
      documents?: Array<{ source: string; visibility?: string }>;
    };
    return ReleaseManifest.parse(parsed ?? {});
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.info(
        `Release manifest not found at ${filePath}, default visibility: ${defaultVisibility}`
      );
      return defaultVisibility === 'public'
        ? ReleaseManifest.allPublic()
        : ReleaseManifest.allPrivate();
    }
    throw error;
  }
}
