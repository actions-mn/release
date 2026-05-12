import { describe, it, expect } from 'vitest';
import {
  ReleaseMetadata,
  parseReleaseMetadata
} from '../../src/domain/release-metadata.js';
import {
  DocumentId,
  DocumentStage,
  DocumentVersion
} from '../../src/domain/types.js';
import { DocumentType } from '../../src/domain/document-metadata.js';
import { Channel } from '../../src/domain/channel.js';
import type { DocumentMetadata } from '../../src/domain/document-metadata.js';

function makeDoc(overrides: Partial<DocumentMetadata> = {}): DocumentMetadata {
  return {
    id: DocumentId.fromRaw('cc-51015'),
    title: 'Test Document',
    version: DocumentVersion.from('1', DocumentStage.fromStatus('published')),
    doctype: 'standard',
    documentType: DocumentType.Standard,
    flavor: 'cc',
    revdate: '2024-01-01',
    sourcePath: 'sources/cc-51015.adoc',
    outputDir: '/tmp',
    formats: ['html', 'pdf'],
    fileBaseName: 'cc-51015',
    ...overrides
  };
}

describe('ReleaseMetadata', () => {
  it('creates metadata from document and channels', () => {
    const doc = makeDoc();
    const channels = [Channel.public('standards')];

    const meta = ReleaseMetadata.fromDocument(doc, channels);
    const json = meta.toJSON();

    expect(json.id).toBe('cc-51015');
    expect(json.title).toBe('Test Document');
    expect(json.edition).toBe('1');
    expect(json.stage).toBe('published');
    expect(json.doctype).toBe('standard');
    expect(json.revdate).toBe('2024-01-01');
    expect(json.formats).toEqual(['html', 'pdf']);
    expect(json.channels).toEqual(['public/standards']);
    expect(json.flavor).toBe('cc');
    expect(json.sourcePath).toBe('sources/cc-51015.adoc');
  });

  it('handles null optional fields', () => {
    const doc = makeDoc({ flavor: undefined, revdate: undefined });
    const meta = ReleaseMetadata.fromDocument(doc, []);
    const json = meta.toJSON();

    expect(json.flavor).toBeNull();
    expect(json.revdate).toBeNull();
    expect(json.channels).toEqual([]);
  });

  it('toString produces valid JSON', () => {
    const doc = makeDoc();
    const meta = ReleaseMetadata.fromDocument(doc, [Channel.public('default')]);

    const parsed = JSON.parse(meta.toString());
    expect(parsed.id).toBe('cc-51015');
  });
});

describe('parseReleaseMetadata', () => {
  it('extracts metadata from body with JSON comment block', () => {
    const body = `content-hash:abc123

<!-- mn-release-metadata
{
  "id": "cc-51015",
  "title": "Test",
  "edition": "1",
  "stage": "published",
  "doctype": "standard",
  "revdate": null,
  "formats": ["html"],
  "channels": ["public/default"],
  "flavor": null,
  "sourcePath": "sources/cc-51015.adoc"
}
-->

## Test Document

| Field | Value |
|---|---|`;

    const meta = parseReleaseMetadata(body);
    expect(meta).not.toBeNull();
    expect(meta!.id).toBe('cc-51015');
    expect(meta!.channels).toEqual(['public/default']);
  });

  it('returns null when no metadata block found', () => {
    const body = `content-hash:abc123

## Old format

| Field | Value |`;

    expect(parseReleaseMetadata(body)).toBeNull();
  });

  it('round-trips through body format', () => {
    const doc = makeDoc();
    const channels = [Channel.public('standards')];
    const meta = ReleaseMetadata.fromDocument(doc, channels);

    const body = [
      'content-hash:abc123',
      '',
      '<!-- mn-release-metadata',
      meta.toString(),
      '-->',
      '',
      '## Test Document'
    ].join('\n');

    const parsed = parseReleaseMetadata(body);
    expect(parsed).not.toBeNull();
    expect(parsed!.id).toBe(meta.toJSON().id);
    expect(parsed!.channels).toEqual(meta.toJSON().channels);
  });
});
