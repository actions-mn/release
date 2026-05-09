import type { DocumentId, DocumentVersion } from './types.js';

export enum DocumentType {
  Standard = 'standard',
  IetfDraft = 'ietf-draft',
  IetfRfc = 'ietf-rfc',
  Iso = 'iso',
  Iec = 'iec',
  Ieee = 'ieee',
  Itu = 'itu',
  Bipm = 'bipm',
  Iho = 'iho',
  Ogc = 'ogc',
  Oiml = 'oiml',
  Un = 'un',
  Csa = 'csa',
  Pdfa = 'pdfa',
  Mpfa = 'mpfa',
  M3aawg = 'm3aawg',
  Ribose = 'ribose'
}

// Detection is identifier-based, not flavor-based. Order matters.
const DETECTION_RULES: ReadonlyArray<{
  readonly test: RegExp;
  readonly type: DocumentType;
}> = [
  { test: /^RFC\s/i, type: DocumentType.IetfRfc },
  { test: /^draft-/i, type: DocumentType.IetfDraft },
  { test: /^ISO/i, type: DocumentType.Iso },
  { test: /^IEC/i, type: DocumentType.Iec },
  { test: /^IEEE/i, type: DocumentType.Ieee },
  { test: /^ITU-/i, type: DocumentType.Itu },
  { test: /^BIPM/i, type: DocumentType.Bipm },
  { test: /^[A-Z]-\d/i, type: DocumentType.Iho },
  { test: /^\d{2}-\d{2,3}/, type: DocumentType.Ogc },
  { test: /^OIML/i, type: DocumentType.Oiml },
  { test: /^GE\./i, type: DocumentType.Un },
  { test: /^csa-/i, type: DocumentType.Csa },
  { test: /^(AN|BPG|TN)\s/i, type: DocumentType.Pdfa },
  { test: /^SU\//i, type: DocumentType.Mpfa },
  { test: /^M3AAWG/i, type: DocumentType.M3aawg },
  { test: /^Ribose/i, type: DocumentType.Ribose }
];

export namespace DocumentType {
  export function fromIdentifier(rawId: string): DocumentType {
    for (const rule of DETECTION_RULES) {
      if (rule.test.test(rawId)) return rule.type;
    }
    return DocumentType.Standard;
  }
}

export interface DocumentMetadata {
  readonly id: DocumentId;
  readonly title: string;
  readonly version: DocumentVersion;
  readonly doctype: string;
  readonly documentType: DocumentType;
  readonly flavor: string | undefined;
  readonly revdate: string | undefined;
  readonly sourcePath: string;
  readonly outputDir: string;
  readonly formats: string[];
}
