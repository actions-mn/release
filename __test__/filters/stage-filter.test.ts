import { describe, it, expect } from 'vitest';
import { StageFilter } from '../../src/filters/stage-filter.js';
import {
  DocumentId,
  DocumentStage,
  DocumentVersion
} from '../../src/domain/types.js';
import { DocumentType } from '../../src/domain/document-metadata.js';
import type { DocumentMetadata } from '../../src/domain/document-metadata.js';

function makeDoc(stage: string): DocumentMetadata {
  return {
    id: DocumentId.fromRaw('cc-51015'),
    title: 'Test',
    version: DocumentVersion.from('1', DocumentStage.fromStatus(stage)),
    doctype: 'standard',
    documentType: DocumentType.Standard,
    flavor: undefined,
    revdate: undefined,
    sourcePath: 'sources/cc-51015.adoc',
    outputDir: '/tmp',
    formats: ['html'],
    fileBaseName: 'cc-51015'
  };
}

describe('StageFilter', () => {
  it('passes all documents when allowedStages is undefined', () => {
    const filter = new StageFilter(undefined);
    const docs = [makeDoc('published'), makeDoc('working-draft')];
    expect(filter.filter(docs)).toHaveLength(2);
  });

  it('filters to only matching stages', () => {
    const filter = new StageFilter(new Set(['published']));
    const docs = [
      makeDoc('published'),
      makeDoc('working-draft'),
      makeDoc('committee-draft')
    ];
    const result = filter.filter(docs);
    expect(result).toHaveLength(1);
    expect(result[0].version.stage.toString()).toBe('published');
  });

  it('allows multiple stages', () => {
    const filter = new StageFilter(new Set(['published', 'final-draft']));
    const docs = [
      makeDoc('published'),
      makeDoc('final-draft'),
      makeDoc('working-draft')
    ];
    const result = filter.filter(docs);
    expect(result).toHaveLength(2);
  });

  it('returns empty when no documents match', () => {
    const filter = new StageFilter(new Set(['published']));
    const docs = [makeDoc('working-draft'), makeDoc('committee-draft')];
    expect(filter.filter(docs)).toHaveLength(0);
  });
});
