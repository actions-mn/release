import type { DocumentMetadata } from '../domain/document-metadata.js';
import type { ReleaseManifest } from '../domain/release-manifest.js';
import type { IDocumentFilter } from '../domain/types.js';

export type { IDocumentFilter } from '../domain/types.js';

export class VisibilityFilter implements IDocumentFilter {
  constructor(private readonly manifest: ReleaseManifest) {}

  filter(documents: readonly DocumentMetadata[]): DocumentMetadata[] {
    return documents.filter((doc) => this.manifest.isPublic(doc.sourcePath));
  }
}
