import { minimatch } from 'minimatch';
import type { DocumentMetadata } from '../domain/document-metadata.js';
import type { IDocumentFilter } from '../domain/types.js';

export class PatternFilter implements IDocumentFilter {
  constructor(private readonly pattern: string) {}

  filter(documents: readonly DocumentMetadata[]): DocumentMetadata[] {
    if (this.pattern === '*') return [...documents];

    return documents.filter((doc) =>
      minimatch(doc.id.toString(), this.pattern)
    );
  }
}
