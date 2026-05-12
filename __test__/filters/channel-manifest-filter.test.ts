import { describe, it, expect } from 'vitest';
import { ChannelManifestFilter } from '../../src/filters/channel-manifest-filter.js';
import { ChannelManifest } from '../../src/domain/channel-manifest.js';
import {
  DocumentId,
  DocumentStage,
  DocumentVersion
} from '../../src/domain/types.js';
import { DocumentType } from '../../src/domain/document-metadata.js';
import type { DocumentMetadata } from '../../src/domain/document-metadata.js';

function makeDoc(sourcePath: string, rawId: string): DocumentMetadata {
  const id = DocumentId.fromRaw(rawId);
  return {
    id,
    title: 'Test',
    version: DocumentVersion.from('1', DocumentStage.fromStatus('published')),
    doctype: 'standard',
    documentType: DocumentType.Standard,
    flavor: undefined,
    revdate: undefined,
    sourcePath,
    outputDir: '/tmp/test',
    formats: ['html'],
    fileBaseName: id.fileName
  };
}

describe('ChannelManifestFilter', () => {
  it('keeps all documents when manifest is allPublic', () => {
    const manifest = ChannelManifest.allPublic();
    const filter = new ChannelManifestFilter(manifest);
    const docs = [makeDoc('a.adoc', 'CC 1'), makeDoc('b.adoc', 'CC 2')];

    const result = filter.filter(docs);
    expect(result).toHaveLength(2);
  });

  it('removes private documents', () => {
    const manifest = ChannelManifest.parse({
      documents: [
        { source: 'sources/cc-51015.adoc' },
        { source: 'sources/cc-51026.adoc', visibility: 'private' }
      ]
    });
    const filter = new ChannelManifestFilter(manifest);
    const docs = [
      makeDoc('sources/cc-51015.adoc', 'CC 51015'),
      makeDoc('sources/cc-51026.adoc', 'CC 51026')
    ];

    const result = filter.filter(docs);
    expect(result).toHaveLength(1);
    expect(result[0].id.toString()).toBe('cc-51015');
  });

  it('removes documents not in manifest (private-by-default)', () => {
    const manifest = ChannelManifest.parse({
      documents: [{ source: 'sources/cc-51015.adoc' }]
    });
    const filter = new ChannelManifestFilter(manifest);
    const docs = [
      makeDoc('sources/cc-51015.adoc', 'CC 51015'),
      makeDoc('sources/cc-99999.adoc', 'CC 99999')
    ];

    const result = filter.filter(docs);
    expect(result).toHaveLength(1);
    expect(result[0].id.toString()).toBe('cc-51015');
  });

  it('returns empty when all documents are private', () => {
    const manifest = ChannelManifest.parse({
      documents: [{ source: 'a.adoc', visibility: 'private' }]
    });
    const filter = new ChannelManifestFilter(manifest);
    const docs = [makeDoc('a.adoc', 'CC 1')];

    const result = filter.filter(docs);
    expect(result).toHaveLength(0);
  });

  it('keeps members-visible documents', () => {
    const manifest = ChannelManifest.parse({
      documents: [
        { source: 'sources/cc-51015.adoc' },
        { source: 'sources/cc-51026.adoc', visibility: 'members' }
      ]
    });
    const filter = new ChannelManifestFilter(manifest);
    const docs = [
      makeDoc('sources/cc-51015.adoc', 'CC 51015'),
      makeDoc('sources/cc-51026.adoc', 'CC 51026')
    ];

    const result = filter.filter(docs);
    expect(result).toHaveLength(2);
  });
});
