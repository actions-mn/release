import type { DocumentMetadata } from '../domain/document-metadata.js';
import type { IDocumentFilter } from '../domain/types.js';

export class StageFilter implements IDocumentFilter {
  constructor(
    private readonly allowedStages: ReadonlySet<string> | undefined
  ) {}

  filter(documents: readonly DocumentMetadata[]): DocumentMetadata[] {
    if (!this.allowedStages) return [...documents];

    return documents.filter((doc) =>
      this.allowedStages!.has(doc.version.stage.toString())
    );
  }
}
