import type { DocumentMetadata } from './document-metadata.js';
import type { Channel } from './channel.js';

export interface ReleaseMetadataJson {
  readonly id: string;
  readonly title: string;
  readonly edition: string;
  readonly stage: string;
  readonly doctype: string;
  readonly revdate: string | null;
  readonly formats: readonly string[];
  readonly channels: readonly string[];
  readonly flavor: string | null;
  readonly sourcePath: string;
}

export class ReleaseMetadata {
  private constructor(private readonly data: ReleaseMetadataJson) {}

  static fromDocument(
    metadata: DocumentMetadata,
    channels: readonly Channel[]
  ): ReleaseMetadata {
    return new ReleaseMetadata({
      id: metadata.id.toString(),
      title: metadata.title,
      edition: metadata.version.editionNumber,
      stage: metadata.version.stage.toString(),
      doctype: metadata.doctype,
      revdate: metadata.revdate ?? null,
      formats: [...metadata.formats],
      channels: channels.map((c) => c.toString()),
      flavor: metadata.flavor ?? null,
      sourcePath: metadata.sourcePath
    });
  }

  toJSON(): ReleaseMetadataJson {
    return { ...this.data };
  }

  toString(): string {
    return JSON.stringify(this.data, null, 2);
  }
}

export function parseReleaseMetadata(body: string): ReleaseMetadataJson | null {
  const match = body.match(/<!-- mn-release-metadata\n([\s\S]*?)\n-->/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as ReleaseMetadataJson;
  } catch {
    return null;
  }
}
