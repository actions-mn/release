import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { ContentHash } from '../domain/types.js';

export async function computeContentHash(
  dirPath: string
): Promise<ContentHash> {
  const files = await collectFiles(dirPath);
  files.sort();

  const hasher = createHash('sha256');

  for (const file of files) {
    const relative = file.slice(dirPath.length).replace(/\\/g, '/');
    hasher.update(relative);
    hasher.update('\0');

    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(file);
      stream.on('data', (chunk: string | Buffer) => hasher.update(chunk));
      stream.on('end', () => resolve());
      stream.on('error', (err) => reject(err));
    });

    hasher.update('\0');
  }

  return ContentHash.fromString(hasher.digest('hex'));
}

async function collectFiles(dir: string): Promise<string[]> {
  const result: string[] = [];

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && !entry.name.endsWith('.hash')) {
        result.push(fullPath);
      }
    }
  }

  try {
    const st = await stat(dir);
    if (!st.isDirectory()) return result;
  } catch {
    return result;
  }

  await walk(dir);
  return result;
}
