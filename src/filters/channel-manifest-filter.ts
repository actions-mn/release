import type { DocumentMetadata } from '../domain/document-metadata.js';
import type { ChannelManifest } from '../domain/channel-manifest.js';
import type { IDocumentFilter } from '../domain/types.js';

export class ChannelManifestFilter implements IDocumentFilter {
  constructor(private readonly manifest: ChannelManifest) {}

  filter(documents: readonly DocumentMetadata[]): DocumentMetadata[] {
    return documents.filter((doc) => {
      const policy = this.manifest.resolve(doc);
      return policy.shouldRelease;
    });
  }
}
