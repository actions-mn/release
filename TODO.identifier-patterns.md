# Document Identifier Patterns Across Metanorma Flavors

Source: Analysis of 225 RXL files from 18 `mn-samples-*` GitHub Pages sites.

## Summary

| Flavor | Count | Identifier Pattern | Tag Pattern | Stages | Doctypes |
|---|---|---|---|---|---|
| BIPM | 47 | `BIPM {series}-{number}` | `bipm-{series}-{number}/ed{N}` | none (edition only) | brochure, cipm-mra, guide, meeting-report, mise-en-pratique, monographie, policy, rapport |
| CC | 1 | `CC/{stage} {number}:{year}` | `cc-{number}/ed{N}` | FDS | standard |
| CSA | 1 | `csa-{number}:{year}` | `csa-{number}/{year}` | published (in status) | standard |
| IEC | 2 | `IEC {stage} {number} ED{N}` | `iec-{number}/ed{N}` | CD | international-standard |
| IEEE | 1 | `IEEE Draft Std {number}/D{N}` | `ieee-{number}/d{N}` | none (draft prefix) | standard |
| IETF I-D | 1 | `draft-{org}-{name}-{ver}` | `id-{org}-{name}/{ver}` | none | internet-draft |
| IETF RFC | 1 | `RFC {number}` | `rfc-{number}/1` | none | rfc |
| IHO | 9 | `{letter}-{number}` | `iho-{letter}-{number}/ed{N}` | none (edition only) | regulation, specification, standard |
| ISO | 44 | `ISO[/{stage}] {number}:{year}[/Amd {n}:{y}]` | `iso-{number}/ed{N}[-{stage}]` | AWI, CD, DAMD, DIS, FDAMD, FDGUIDE, FDIS, FDPAS, FDTR, FDTS, IS, PRF, PWI | amendment, directive, guide, international-standard, international-workshop-agreement, publicly-available-specification, technical-report, technical-specification |
| ITU | 23 | `ITU-{sector} {series}.{number}` | `itu-{sector}-{series}-{number}/ed{N}` | none (edition only) | focus-group, implementers-guide, recommendation, recommendation-annex, resolution, technical-paper, technical-report |
| M3AAWG | 3 | `{number}:{year}` | `m3aawg-{number}/{year}` | none | policy, report |
| MPFA | 6 | `{type}/{number}` or `V.{N}` | `mpfa-{type}-{number}/ed{N}` | none (edition only) | circular, compliance-standards-for-mpf-trustees, guidelines, supervision-of-mpf-intermediaries |
| OGC | 21 | `{NN}-{NNN}r{N}` | `ogc-{NN}-{NNN}/v{N}` | none (edition/version only) | 14 types (abstract-specification-topic, best-practice, community-standard, engineering-report, standard, etc.) |
| OIML | 15 | `OIML {letter} {number}[-{part}]` | `oiml-{letter}-{number}/ed{N}` | IS | amendment, international-standard |
| PDFA/Ribose | 11 | `{prefix} {topic}:{year} ({ver})` or `{identifier}` | `pdfa-{topic}/{ver}` or `ribose-{id}/ed{N}` | none (edition only) | standard |
| Standoc | 27 | Same as ISO | Same as ISO | AWI, CD, DIS, FDIS, IS, PRF, PWI, WD + Amd variants | Same as ISO |
| UN | 10 | `GE.{YY}-{NNNN}(E)` or `{number}` | `un-ge-{YY}-{NNNN}/1` or `un-{number}/1` | none | agenda, plenary, plenary-attachment, recommendation |

## Detailed Identifier Patterns

### BIPM
Pattern: `BIPM {series}[-{subseries}][-{qualifier}]`
```
BIPM ITS-90 MEP-1 A1          → brochure/mise-en-pratique, edition varies
BIPM CIPM MRA-D-02            → cipm-mra, edition 3.3
BIPM PLTS-2000                → guide or mise-en-pratique, edition 1
BIPM JCTLM_DB_WG_P-00         → policy, edition 1.1
BIPM BIPM-2015/01             → rapport, edition 1
BIPM 203                      → brochure (no edition)
```
Tag: `bipm-{series-kebab}/ed{edition}` or `bipm-{number}/ed{edition}`
- No stages. Editions are arbitrary (1, 1.1, 2, 3.3, 5.2, etc.).
- 8 doctypes: brochure, cipm-mra, guide, meeting-report, mise-en-pratique, monographie, policy, rapport.

### CC (CalConnect)
Pattern: `CC/{stage} {number}:{year}`
```
CC/FDS 18011:2018              → standard, edition 1
```
Tag: `cc-{number}/ed{N}-{stage-lowercase}`
- Stage appears in docidentifier prefix: FDS → `cc-18011/ed1-fds`

### CSA (Cloud Security Alliance)
Pattern: `csa-{number}:{year}`
```
csa-01:2019                    → standard
```
Tag: `csa-{number}/{year}`
- No stages or editions.
- Status element contains `<stage>published</stage>`.

### IEC
Pattern: `IEC {stage} {number} ED{N}`
```
IEC CD 17301-1:2016 ED2        → international-standard, stage CD (30), edition 2
```
Tag: `iec-{number-kebab}/ed{N}-{stage-lowercase}`
- Stage abbreviations appear in identifier: CD, etc.
- Edition indicated as `ED{N}` in identifier.

### IEEE
Pattern: `IEEE Draft Std {number}/D{N}`
```
IEEE Draft Std 987.6-2020/D3   → standard
```
Tag: `ieee-{number-kebab}/d{draft-number}`
- Draft status indicated by "Draft" prefix and `/D{N}` suffix.
- Multiple alternate identifiers: P987.6/D3, STDXXXXX, ISBN.

### IETF Internet-Draft
Pattern: `draft-{org}-{name}-{ver}`
```
draft-camelot-holy-grenade-01  → internet-draft
```
Tag: `id-{org}-{name}/{ver}` → `id-camelot-holy-grenade/01`

### IETF RFC
Pattern: `RFC {number}`
```
RFC 8140                       → rfc
RFC 1149                       → rfc (with embedded relations to other RFCs)
```
Tag: `rfc-{number}/1`

### IHO (International Hydrographic Organization)
Pattern: `{letter}-{number}[-{qualifier}]`
```
B-12                           → standard, edition 2.0.3
S-102                          → standard, edition 2.1.0
M-1                            → regulation, edition 2.1.0
S-Guidelines-S5-S8             → specification, edition 2.1.0
```
Tag: `iho-{letter}-{number}/v{edition}`
- Letters: B, C, M, S
- Editions are semver-like: 1.0.1, 2.0.3, 2.1.0, 6
- 3 doctypes: regulation, specification, standard

### ISO
Pattern: `ISO[/{stage-prefix}] {number}:{year}[/Amd {n}:{y}]`
```
ISO 17301-1:2016               → international-standard, stage IS (60), edition 2
ISO/AWI 17301-1:2016           → international-standard, stage AWI (10), edition 2
ISO/CD 17301-1:2016            → international-standard, stage CD (30), edition 2
ISO/DIS 17301-1:2016           → international-standard, stage DIS (40), edition 2
ISO/FDIS 17301-1:2016          → international-standard, stage FDIS (50), edition 2
ISO/PRF 17301-1:2016           → international-standard, stage PRF (60), edition 2
ISO/PWI 17301-1:2016           → international-standard, stage PWI (00), edition 2
ISO 17301-1:2016/Amd 1:2017   → amendment, stage IS (60), edition 2
ISO DIR:2020                   → directive, stage IS (60), edition 11 or 16
ISO/FDGuide 99999.2:2020       → guide, stage FDGUIDE (50), edition 1
ISO/FDPAS 23263:2019          → publicly-available-specification, stage FDPAS (50), edition 1
ISO/FDTR 29166:2011           → technical-report, stage FDTR (50), edition 1
ISO/FDTS 17755-2-2:2020       → technical-specification, stage FDTS (50), edition 1
ISO/FDIS IWA 30-1.2:2019      → international-workshop-agreement, stage FDIS (50), edition 1
```
Tag: `iso-{number-kebab}/ed{N}[-{stage-lowercase}]`
- 13 stage abbreviations: AWI, CD, DAMD, DIS, FDAMD, FDGUIDE, FDIS, FDPAS, FDTR, FDTS, IS, PRF, PWI
- Stage numbers: 00 (PWI), 10 (AWI), 20 (WD), 30 (CD), 40 (DIS/DAMD), 50 (FDIS/FDAMD/etc), 60 (IS/PRF)
- 8 doctypes: amendment, directive, guide, international-standard, international-workshop-agreement, publicly-available-specification, technical-report, technical-specification
- Special sub-doctype prefix in identifier: ISO/FDGuide, ISO/FDPAS, ISO/FDTR, ISO/FDTS, ISO/TR, ISO/TS, ISO IWA

### ITU (International Telecommunication Union)
Pattern: `ITU-{sector} {series}.{number}[-{sub}] [{qualifier}]`
```
ITU-T G.650.1                  → recommendation
ITU-T H.782                    → recommendation
ITU-D D.19                     → recommendation
ITU-T G.8001/Y.1354 Implementers' Guide → implementers-guide
ITU-T FG-AI4H DEL01            → focus-group, edition 1
ITU-T A.8                      → resolution
ITU-T Z.100                    → recommendation-annex
ITU-T JSTP-IBBDTV              → technical-paper
ITU-T QSTR-COUNTERFEIT         → technical-report
ITU-T FSTP.ACC-WebVRI          → technical-paper
ITU-T LSTP-GLSR                → technical-paper
```
Tag: `itu-{sector}-{series}-{number}/ed{N}`
- Sectors: T (Telecommunication), D (Development)
- 7 doctypes: focus-group, implementers-guide, recommendation, recommendation-annex, resolution, technical-paper, technical-report
- Editions: typically 1, sometimes 2
- Identifier suffix `-E` denotes language (en from second docidentifier)
- No stage abbreviations

### M3AAWG (Messaging, Malware and Mobile Anti-Abuse Working Group)
Pattern: `{number}:{year}` (sometimes empty number)
```
333:2018                        → report
:2020                           → policy
:2014                           → report
```
Tag: `m3aawg-{number}/{year}` (or `m3aawg-doc-{N}/{year}`)
- Identifiers can have empty number part
- Edition: 1

### MPFA (Mandatory Provident Fund Schemes Authority)
Pattern: `{type}/{category}/{number}` or `V.{N}`
```
SU/CTR/2000/002                → circular, edition 1
SU/CTR/2001/001                → circular, edition 1
V.2                            → guidelines, edition 1
(empty)                        → supervision-of-mpf-intermediaries, edition 1
```
Tag: `mpfa-{type}-{number}/ed{N}`
- 4 doctypes, all MPFA-specific
- Some documents have no docidentifier

### OGC (Open Geospatial Consortium)
Pattern: `{NN}-{NNN}[r{N}]`
```
05-020r27                      → policy, edition 27.0
17-069r3                       → standard, edition 1.0
14-065r2                       → standard, edition 2.0.2
18-046                          → engineering-report
```
Tag: `ogc-{NN}-{NNN}/v{edition}` or `ogc-{NN}-{NNN}r{N}/v{edition}`
- Editions: 1.0, 1.1, 2.0, 2.0.2, 2.1, 26.0, 27.0
- 14 doctypes: the most diverse set of any flavor
- Has both internal and external identifier types

### OIML (International Organization of Legal Metrology)
Pattern: `OIML {letter} {number}[-{part}]`
```
OIML B 22                      → international-standard, edition 2023
OIML R 60                      → international-standard, edition 2021
OIML R 60-1                    → international-standard, edition 2
OIML R 60-2                    → international-standard, edition 2
OIML D 36                      → international-standard, edition 2020
OIML G 21                      → international-standard, edition 2017
OIML E 6                       → international-standard, edition 2011
OIML R 7                       → international-standard, edition 1979
Amendment (2009) to OIML R 138:2007 → amendment, edition 2009
```
Tag: `oiml-{letter}-{number}/ed{edition}`
- Letters: B (Bureau), D (Document), E (Electronic?), G (Guide), R (Recommendation)
- Editions can be years (1979, 2007, 2009, ...) or numbers (2)
- Stage: IS (60) for all — essentially no stage variation
- 2 doctypes: amendment, international-standard

### PDFA / Ribose
Pattern: `{prefix} {topic}:{year} ({semver})` or `{identifier}`
```
AN 001:2018 (1.0.0)            → standard (ribose flavor)
AN hdr-faq:2025 (1.0.0)        → standard (ribose flavor)
BPG pdfa-ua:2025 (1.0.0)       → standard (ribose flavor)
TN 0010:2017 (1.0.0)           → standard (ribose flavor)
XXXXX(d)                       → standard (ribose flavor)
Rept 11021                     → (ribose flavor)
```
Tag: `pdfa-{prefix}-{topic}/{version}` or `ribose-{id}/ed{N}`
- Prefixes: AN (Application Note), BPG (Best Practice Guide), TN (Technical Note)
- Versions embedded in identifier as semver: (1.0.0), (1.1.0)
- All under `ribose` flavor in RXL

### Standoc
Same identifier patterns as ISO (it's the generic flavor that produces ISO-style output).
Additional stage abbreviations: WD, AWI Amd, CD Amd, DAmd, FDAmd, PWI Amd, WD Amd

### UN (United Nations)
Pattern: `GE.{YY}-{NNNN}(E)` or `{number}`
```
GE.18-01763(E)                 → plenary
GE.18-02016(E)                 → plenary-attachment
GE.19-00825(E)                 → plenary-attachment
GE.20-02502(E)                 → recommendation
42                              → recommendation
(empty)                         → agenda
```
Tag: `un-ge-{YY}-{NNNN}/1` or `un-{number}/1`
- GE = General Assembly document symbol
- (E) suffix = English
- 4 doctypes: agenda, plenary, plenary-attachment, recommendation

## All Unique Stage Abbreviations

```
ISO/Standoc: AWI, CD, DAMD, DAmd, DIS, FDAMD, FDAmd, FDGUIDE, FDIS, FDPAS, FDTR, FDTS, IS, PRF, PWI, WD
             + Amendment variants: AWI Amd, CD Amd, PWI Amd, WD Amd
IEC:         CD
```

## All Unique Doctypes (47 total)

```
abstract-specification-topic   agenda                         amendment                      best-practice
brochure                       cipm-mra                       circular                       community-practice
community-standard             compliance-standards-for-mpf-trustees  directive               discussion-paper
engineering-report             focus-group                    guide                          guidelines
implementers-guide             international-standard         international-workshop-agreement internet-draft
meeting-report                 mise-en-pratique               monographie                    other
plenary                        plenary-attachment             policy                         publicly-available-specification
rapport                        recommendation                 recommendation-annex           reference-model
regulation                     release-notes                  report                         resolution
rfc                            specification                  standard                       supervision-of-mpf-intermediaries
technical-paper                technical-report               technical-specification         test-suite
user-guide                     white-paper
```

## Tag Naming Strategy Recommendations

### Current Strategy (from spec)
| Type | Tag | Asset |
|---|---|---|
| CC published | `cc-51015/ed1` | `cc-51015-ed1.zip` |
| CC draft | `cc-51015/ed2-wd` | `cc-51015-ed2-wd.zip` |
| ISO published | `iso-8601-1-2019/ed1` | `iso-8601-1-2019-ed1.zip` |
| ISO draft | `iso-wd-8601-1-2026/ed2-wd` | `iso-wd-8601-1-2026-ed2-wd.zip` |
| IETF I-D | `id-calext-jscalendar/32` | `draft-ietf-calext-jscalendar-32.zip` |
| IETF RFC | `rfc-8984/1` | `rfc-8984.zip` |

### Proposed Additional Strategies

| Flavor | Example Identifier | Tag | Asset |
|---|---|---|---|
| **BIPM** | `BIPM BIPM-2015/01` | `bipm-bipm-2015-01/ed1` | `bipm-bipm-2015-01-ed1.zip` |
| **BIPM** | `BIPM CIPM MRA-D-02` | `bipm-cipm-mra-d-02/ed3.3` | `bipm-cipm-mra-d-02-ed3.3.zip` |
| **CC** | `CC/FDS 18011:2018` | `cc-18011/ed1-fds` | `cc-18011-ed1-fds.zip` |
| **CSA** | `csa-01:2019` | `csa-01/2019` | `csa-01-2019.zip` |
| **IEC** | `IEC CD 17301-1:2016 ED2` | `iec-17301-1/ed2-cd` | `iec-17301-1-ed2-cd.zip` |
| **IEEE** | `IEEE Draft Std 987.6-2020/D3` | `ieee-987-6-2020/d3` | `ieee-987-6-2020-d3.zip` |
| **IHO** | `S-102` (ed 2.1.0) | `iho-s-102/v2.1.0` | `iho-s-102-v2.1.0.zip` |
| **IHO** | `B-12` (ed 2.0.3) | `iho-b-12/v2.0.3` | `iho-b-12-v2.0.3.zip` |
| **ITU** | `ITU-T G.650.1` (ed 1) | `itu-t-g-650-1/ed1` | `itu-t-g-650-1-ed1.zip` |
| **ITU** | `ITU-D D.19` (ed 1) | `itu-d-d-19/ed1` | `itu-d-d-19-ed1.zip` |
| **M3AAWG** | `333:2018` | `m3aawg-333/2018` | `m3aawg-333-2018.zip` |
| **MPFA** | `SU/CTR/2000/002` (ed 1) | `mpfa-su-ctr-2000-002/ed1` | `mpfa-su-ctr-2000-002-ed1.zip` |
| **OGC** | `17-069r3` (ed 1.0) | `ogc-17-069r3/v1.0` | `ogc-17-069r3-v1.0.zip` |
| **OGC** | `05-020r27` (ed 27.0) | `ogc-05-020r27/v27.0` | `ogc-05-020r27-v27.0.zip` |
| **OIML** | `OIML R 60` (ed 2021) | `oiml-r-60/ed2021` | `oiml-r-60-ed2021.zip` |
| **OIML** | `OIML R 60-1` (ed 2) | `oiml-r-60-1/ed2` | `oiml-r-60-1-ed2.zip` |
| **PDFA** | `AN 001:2018 (1.0.0)` | `pdfa-an-001/v1.0.0` | `pdfa-an-001-v1.0.0.zip` |
| **Ribose** | `XXXXX(d)` (ed 1) | `ribose-xxxxx-d/ed1` | `ribose-xxxxx-d-ed1.zip` |
| **UN** | `GE.18-01763(E)` | `un-ge-18-01763/1` | `un-ge-18-01763-1.zip` |

## Key Observations for Implementation

1. **Flavor detection**: The `<flavor>` element in RXL's `<ext>` block is the authoritative source. It's present in most flavors but absent in CSA, M3AAWG, Standoc, and some PDFA/MPFA docs.

2. **Identifier extraction**: Use `<docidentifier primary="true">` first. If no primary, fall back to first `<docidentifier>`. The `type` attribute varies by flavor.

3. **Stage handling**: Only ISO, Standoc, and IEC use stage abbreviations. Most flavors have no stage concept — they use editions or version numbers instead.

4. **Edition formats vary widely**:
   - ISO: integers (1, 2, 3)
   - BIPM: decimals (1.1, 3.3, 5.2)
   - IHO: semver-like (2.0.3, 2.1.0)
   - OGC: version-like (1.0, 2.0.2, 27.0)
   - OIML: years (1979, 2021) or integers (2)
   - PDFA: semver in identifier (1.0.0, 1.1.0)

5. **No RXL data available for**: GB (Chinese Standards), Plateau, IHO-PDF.

6. **Some flavors have sparse data**: CSA (1 doc), IEEE (1 doc), CC (1 doc). Real-world usage may reveal additional patterns.

7. **Many flavors have no stage concept at all**: BIPM, IHO, ITU, OGC, PDFA, UN, MPFA, M3AAWG all use edition/version only, with no stage abbreviation.

8. **Document type detection from identifier**:
   - `draft-*` prefix → IETF I-D
   - `RFC` prefix → IETF RFC  
   - `ISO` prefix → ISO/Standoc
   - `IEC` prefix → IEC
   - `IEEE` prefix → IEEE
   - `ITU-*` prefix → ITU
   - `BIPM` prefix → BIPM
   - `CC/` prefix → CC
   - `OIML` prefix → OIML
   - `csa-` prefix → CSA
   - `GE.` prefix → UN
   - Single letter dash number (B-12, S-102) → IHO
   - NN-NNN pattern → OGC
   - `AN`, `BPG`, `TN` prefix with `(semver)` → PDFA
   - `SU/CTR/` prefix → MPFA
