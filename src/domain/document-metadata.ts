import type { DocumentId, DocumentVersion } from './types.js';

export enum DocumentType {
  Standard = 'standard',
  IetfDraft = 'ietf-draft',
  IetfRfc = 'ietf-rfc'
}

export interface DocumentMetadata {
  readonly id: DocumentId;
  readonly title: string;
  readonly version: DocumentVersion;
  readonly doctype: string;
  readonly documentType: DocumentType;
  readonly revdate: string | undefined;
  readonly sourcePath: string;
  readonly outputDir: string;
  readonly formats: string[];
}
