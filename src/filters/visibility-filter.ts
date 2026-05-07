import type { DocumentMetadata } from '../domain/document-metadata.js';
import type { ReleaseManifest } from '../domain/release-manifest.js';
import type { IVisibilityFilter } from '../domain/types.js';

export type { IVisibilityFilter } from '../domain/types.js';

export class VisibilityFilter implements IVisibilityFilter {
  filter(
    documents: DocumentMetadata[],
    manifest: ReleaseManifest
  ): DocumentMetadata[] {
    return documents.filter((doc) => manifest.isPublic(doc.sourcePath));
  }
}
