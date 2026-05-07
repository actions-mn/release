import { minimatch } from 'minimatch';
import type { DocumentMetadata } from '../domain/document-metadata.js';

export class PatternFilter {
  constructor(private readonly pattern: string) {}

  filter(documents: DocumentMetadata[]): DocumentMetadata[] {
    if (this.pattern === '*') return documents;

    return documents.filter((doc) =>
      minimatch(doc.id.toString(), this.pattern)
    );
  }
}
