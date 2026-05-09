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
    flavor: undefined,
    revdate: undefined,
    sourcePath,
    outputDir: '/tmp/test',
    formats: ['html']
  };
}

describe('VisibilityFilter', () => {
  it('keeps all documents when manifest is allPublic', () => {
    const manifest = ReleaseManifest.allPublic();
    const filter = new VisibilityFilter(manifest);
    const docs = [makeDoc('a.adoc', 'CC 1'), makeDoc('b.adoc', 'CC 2')];

    const result = filter.filter(docs);
    expect(result).toHaveLength(2);
  });

  it('removes private documents', () => {
    const manifest = ReleaseManifest.parse({
      documents: [
        { source: 'sources/cc-51015.adoc' },
        { source: 'sources/cc-51026.adoc', visibility: 'private' }
      ]
    });
    const filter = new VisibilityFilter(manifest);
    const docs = [
      makeDoc('sources/cc-51015.adoc', 'CC 51015'),
      makeDoc('sources/cc-51026.adoc', 'CC 51026')
    ];

    const result = filter.filter(docs);
    expect(result).toHaveLength(1);
    expect(result[0].id.toString()).toBe('cc-51015');
  });

  it('removes documents not in manifest', () => {
    const manifest = ReleaseManifest.parse({
      documents: [{ source: 'sources/cc-51015.adoc' }]
    });
    const filter = new VisibilityFilter(manifest);
    const docs = [
      makeDoc('sources/cc-51015.adoc', 'CC 51015'),
      makeDoc('sources/cc-99999.adoc', 'CC 99999')
    ];

    const result = filter.filter(docs);
    expect(result).toHaveLength(1);
    expect(result[0].id.toString()).toBe('cc-51015');
  });

  it('returns empty when all documents are private', () => {
    const manifest = ReleaseManifest.parse({
      documents: [{ source: 'a.adoc', visibility: 'private' }]
    });
    const filter = new VisibilityFilter(manifest);
    const docs = [makeDoc('a.adoc', 'CC 1')];

    const result = filter.filter(docs);
    expect(result).toHaveLength(0);
  });
});
