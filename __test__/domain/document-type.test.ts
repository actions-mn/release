import { describe, it, expect } from 'vitest';
import { DocumentType } from '../../src/domain/document-metadata.js';

describe('DocumentType.fromIdentifier', () => {
  it.each([
    // CC / Standard (default)
    ['CC 51015', DocumentType.Standard],
    ['CC/FDS 18011:2018', DocumentType.Standard],
    ['', DocumentType.Standard],
    ['Unknown Doc 123', DocumentType.Standard],

    // IETF RFC
    ['RFC 8984', DocumentType.IetfRfc],
    ['RFC 1149', DocumentType.IetfRfc],
    ['rfc 8984', DocumentType.IetfRfc],

    // IETF I-D
    ['draft-ietf-calext-jscalendar-32', DocumentType.IetfDraft],
    ['draft-camelot-holy-grenade-01', DocumentType.IetfDraft],

    // ISO
    ['ISO 8601-1:2019', DocumentType.Iso],
    ['ISO/WD 8601-1:2026', DocumentType.Iso],
    ['ISO/CD 8601-2:2026', DocumentType.Iso],
    ['ISO/AWI 17301-1:2016', DocumentType.Iso],
    ['ISO 17301-1:2016/Amd 1:2017', DocumentType.Iso],

    // IEC
    ['IEC CD 17301-1:2016 ED2', DocumentType.Iec],
    ['IEC 62443-3-3:2013', DocumentType.Iec],

    // IEEE
    ['IEEE Draft Std 987.6-2020/D3', DocumentType.Ieee],
    ['IEEE Std 802.3-2018', DocumentType.Ieee],

    // ITU
    ['ITU-T G.650.1', DocumentType.Itu],
    ['ITU-D D.19', DocumentType.Itu],

    // BIPM
    ['BIPM ITS-90 MEP-1 A1', DocumentType.Bipm],
    ['BIPM BIPM-2015/01', DocumentType.Bipm],

    // IHO
    ['B-12', DocumentType.Iho],
    ['S-102', DocumentType.Iho],
    ['M-1', DocumentType.Iho],

    // OGC
    ['05-020r27', DocumentType.Ogc],
    ['17-069r3', DocumentType.Ogc],

    // OIML
    ['OIML R 60', DocumentType.Oiml],

    // UN
    ['GE.18-01763(E)', DocumentType.Un],

    // CSA
    ['csa-01:2019', DocumentType.Csa],

    // PDFA
    ['AN 001:2018 (1.0.0)', DocumentType.Pdfa],
    ['BPG 123', DocumentType.Pdfa],
    ['TN 42', DocumentType.Pdfa],

    // MPFA
    ['SU/CTR/2000/002', DocumentType.Mpfa],

    // M3AAWG
    ['M3AAWG Best Practice', DocumentType.M3aawg],

    // Ribose
    ['Ribose RSC', DocumentType.Ribose]
  ] as const)('fromIdentifier("%s") → %s', (input, expected) => {
    expect(DocumentType.fromIdentifier(input)).toBe(expected);
  });
});
