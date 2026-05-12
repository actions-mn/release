import type { DocumentMetadata } from '../domain/document-metadata.js';
import type { IDocumentFilter } from '../domain/types.js';

export type { IDocumentFilter } from '../domain/types.js';

export interface ManifestLike {
  isPublic(sourcePath: string): boolean;
}

export class VisibilityFilter implements IDocumentFilter {
  constructor(private readonly manifest: ManifestLike) {}

  filter(documents: readonly DocumentMetadata[]): DocumentMetadata[] {
    return documents.filter((doc) => this.manifest.isPublic(doc.sourcePath));
  }
}
