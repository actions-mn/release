import { describe, it, expect } from 'vitest';
import { PatternFilter } from '../../src/filters/pattern-filter.js';
import {
  DocumentId,
  DocumentStage,
  DocumentVersion
} from '../../src/domain/types.js';
import { DocumentType } from '../../src/domain/document-metadata.js';
import type { DocumentMetadata } from '../../src/domain/document-metadata.js';

function makeDoc(rawId: string): DocumentMetadata {
  const id = DocumentId.fromRaw(rawId);
  return {
    id,
    title: rawId,
    version: DocumentVersion.from('1', DocumentStage.fromStatus('published')),
    doctype: 'standard',
    documentType: DocumentType.Standard,
    revdate: undefined,
    sourcePath: `${rawId}.adoc`,
    outputDir: '/tmp/test',
    formats: ['html'],
    fileBaseName: id.fileName
  };
}

describe('PatternFilter', () => {
  it('* keeps all documents', () => {
    const filter = new PatternFilter('*');
    const docs = [makeDoc('CC 51015'), makeDoc('ISO 8601')];
    expect(filter.filter(docs)).toHaveLength(2);
  });

  it('cc-* keeps only CC documents', () => {
    const filter = new PatternFilter('cc-*');
    const docs = [
      makeDoc('CC 51015'),
      makeDoc('CC 51024'),
      makeDoc('ISO 8601')
    ];
    const result = filter.filter(docs);
    expect(result).toHaveLength(2);
    expect(result.every((d) => d.id.toString().startsWith('cc-'))).toBe(true);
  });

  it('iso-* keeps only ISO documents', () => {
    const filter = new PatternFilter('iso-*');
    const docs = [makeDoc('CC 51015'), makeDoc('ISO 8601')];
    const result = filter.filter(docs);
    expect(result).toHaveLength(1);
    expect(result[0].id.toString()).toContain('iso');
  });

  it('non-matching pattern returns empty', () => {
    const filter = new PatternFilter('itu-*');
    const docs = [makeDoc('CC 51015'), makeDoc('ISO 8601')];
    expect(filter.filter(docs)).toHaveLength(0);
  });

  it('exact match pattern', () => {
    const filter = new PatternFilter('cc-51015');
    const docs = [makeDoc('CC 51015'), makeDoc('CC 51024')];
    const result = filter.filter(docs);
    expect(result).toHaveLength(1);
    expect(result[0].id.toString()).toBe('cc-51015');
  });
});
