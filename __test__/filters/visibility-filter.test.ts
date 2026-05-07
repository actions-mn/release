import { describe, it, expect } from 'vitest';
import { VisibilityFilter } from '../../src/filters/visibility-filter.js';
import { ReleaseManifest } from '../../src/domain/release-manifest.js';
import {
  DocumentId,
  DocumentStage,
  DocumentVersion
} from '../../src/domain/types.js';
import { DocumentType } from '../../src/domain/document-metadata.js';
import type { DocumentMetadata } from '../../src/domain/document-metadata.js';

function makeDoc(sourcePath: string, rawId: string): DocumentMetadata {
  return {
    id: DocumentId.fromRaw(rawId),
    title: 'Test',
    version: DocumentVersion.from('1', DocumentStage.fromStatus('published')),
    doctype: 'standard',
    documentType: DocumentType.Standard,
    revdate: undefined,
    sourcePath,
    outputDir: '/tmp/test',
    formats: ['html']
  };
}

describe('VisibilityFilter', () => {
  it('keeps all documents when manifest is allPublic', () => {
    const filter = new VisibilityFilter();
    const docs = [makeDoc('a.adoc', 'CC 1'), makeDoc('b.adoc', 'CC 2')];
    const manifest = ReleaseManifest.allPublic();

    const result = filter.filter(docs, manifest);
    expect(result).toHaveLength(2);
  });

  it('removes private documents', () => {
    const filter = new VisibilityFilter();
    const docs = [
      makeDoc('sources/cc-51015.adoc', 'CC 51015'),
      makeDoc('sources/cc-51026.adoc', 'CC 51026')
    ];
    const manifest = ReleaseManifest.parse({
      documents: [
        { source: 'sources/cc-51015.adoc' },
        { source: 'sources/cc-51026.adoc', visibility: 'private' }
      ]
    });

    const result = filter.filter(docs, manifest);
    expect(result).toHaveLength(1);
    expect(result[0].id.toString()).toBe('cc-51015');
  });

  it('removes documents not in manifest', () => {
    const filter = new VisibilityFilter();
    const docs = [
      makeDoc('sources/cc-51015.adoc', 'CC 51015'),
      makeDoc('sources/cc-99999.adoc', 'CC 99999')
    ];
    const manifest = ReleaseManifest.parse({
      documents: [{ source: 'sources/cc-51015.adoc' }]
    });

    const result = filter.filter(docs, manifest);
    expect(result).toHaveLength(1);
    expect(result[0].id.toString()).toBe('cc-51015');
  });

  it('returns empty when all documents are private', () => {
    const filter = new VisibilityFilter();
    const docs = [makeDoc('a.adoc', 'CC 1')];
    const manifest = ReleaseManifest.parse({
      documents: [{ source: 'a.adoc', visibility: 'private' }]
    });

    const result = filter.filter(docs, manifest);
    expect(result).toHaveLength(0);
  });
});
