# 10: Testing Specification

> **Status: COMPLETED** — Implemented and tested.

## Goal

Comprehensive test suite following `site-gen` conventions (vitest, 80% coverage threshold). Tests are organized by domain concern, with shared fixtures.

## Test Structure

```
__test__/
├── fixtures/
│   ├── rxl/
│   │   ├── cc-published.rxl        # CC document, published
│   │   ├── cc-working-draft.rxl    # CC document, working-draft
│   │   ├── cc-committee-draft.rxl  # CC document, committee-draft
│   │   ├── iso-published.rxl       # ISO document, 60.60
│   │   ├── iso-wd.rxl             # ISO document, 20.20
│   │   ├── ietf-id.rxl            # IETF Internet-Draft
│   │   ├── ietf-rfc.rxl           # IETF RFC
│   │   └── malformed.rxl          # Invalid XML
│   ├── manifest/
│   │   ├── full.yml               # All documents listed with visibility
│   │   ├── partial.yml            # Only some documents listed
│   │   ├── empty.yml              # Empty documents array
│   │   └── invalid.yml            # Malformed YAML
│   └── site/
│       └── documents/
│           ├── cc-51015/
│           │   ├── document.html
│           │   ├── document.pdf
│           │   ├── document.xml
│           │   └── document.rxl
│           └── cc-51024/
│               └── ...
├── domain/
│   ├── document-id.test.ts
│   ├── document-stage.test.ts
│   ├── document-version.test.ts
│   ├── release-tag.test.ts
│   └── release-manifest.test.ts
├── extractors/
│   ├── rxl-extractor.test.ts
│   └── document-discovery.test.ts
├── filters/
│   ├── visibility-filter.test.ts
│   └── pattern-filter.test.ts
├── detection/
│   ├── content-hash.test.ts
│   └── change-detector.test.ts
├── packaging/
│   ├── zip-packager.test.ts
│   └── tag-builder.test.ts
├── publishing/
│   └── github-release-publisher.test.ts
└── pipeline.test.ts
```

## Test Specifications

### Domain Types (`domain/`)

**`document-id.test.ts`** — Table-driven tests for `DocumentId.fromRaw()`:
- CC identifiers: `"CC 51015"` → `"cc-51015"`, `"CC 34200"` → `"cc-34200"`
- ISO identifiers: `"ISO/WD 8601-1:2026"` → `"iso-wd-8601-1-2026"`, `"ISO 8601-1:2019"` → `"iso-8601-1-2019"`
- IETF identifiers: `"draft-ietf-calext-jscalendar-32"` → `"draft-ietf-calext-jscalendar-32"`, `"RFC 8984"` → `"rfc-8984"`
- Edge cases: empty string (throws), whitespace-only (throws), special characters
- Idempotent: normalizing an already-normalized id returns same value
- Equality: `DocumentId.fromRaw("CC 51015").equals(DocumentId.fromRaw("cc 51015"))` → true

**`document-stage.test.ts`** — Stage mapping:
- `fromStatus`: each CC stage name → correct StageName
- `fromIsoStage`: 20.20 → working-draft, 30.00 → committee-draft, 40.00 → draft-standard, 50.00 → final-draft, 60.60 → published, 95.00 → withdrawn
- `isPublished`: true for published/in-force, false for all others
- `isDraft`: true for WD/CD/DS/FD, false for published/withdrawn/cancelled
- `tagSuffix`: empty for published, `-wd` for working-draft, etc.

**`document-version.test.ts`**:
- `tagComponent`: edition + stage suffix
- `toFileName`: zip filename with doc-id
- `isPreRelease`: draft stages are pre-release

**`release-tag.test.ts`**:
- `from()` with CC published → `"cc-51015/ed1"`
- `from()` with CC draft → `"cc-51015/ed2-wd"`
- `from()` with ISO → correct tag
- `parse()` roundtrip: `ReleaseTag.from(...).toString()` → parse → same tag
- `isPreRelease` reflects document stage

**`release-manifest.test.ts`**:
- Parse valid YAML → correct entries
- Missing visibility defaults to public
- Explicit private visibility
- `allPublic()` returns public for any path
- Non-existent source path → private (when file exists)
- Non-existent source path → public (when allPublic)

### Extractors (`extractors/`)

**`rxl-extractor.test.ts`** — Test with fixture RXL files:
- CC published: correct id, stage, edition, title, doctype
- CC draft: correct stage suffix
- ISO published (60.60): stage maps to published
- ISO WD (20.20): stage maps to working-draft
- IETF I-D: correct id normalization
- Malformed XML: throws with descriptive error
- Missing docidentifier: throws
- Missing edition: defaults to "0"

**`document-discovery.test.ts`**:
- Single RXL → one document
- Multiple RXLs → multiple documents
- Nested directory structure → all found
- No RXLs → empty array
- One malformed RXL → others succeed, failed logged

### Filters (`filters/`)

**`visibility-filter.test.ts`**:
- All documents public → all pass
- Some private → only public pass
- Empty manifest (allPublic) → all pass
- Document not in manifest → filtered out (when manifest exists)

**`pattern-filter.test.ts`**:
- `"*"` → all pass
- `"cc-*"` → only CC documents pass
- `"iso-*"` → only ISO documents pass
- No match → empty array

### Detection (`detection/`)

**`content-hash.test.ts`**:
- Same directory, same files → same hash
- Different content → different hash
- File order doesn't matter (deterministic sort)
- Empty directory → hash of nothing
- Large files → completes without OOM

**`change-detector.test.ts`** — Mock Octokit:
- New tag (404) → changed
- Same hash → not changed
- Different hash → changed
- Force mode → always changed
- API error (500) → changed (fail open)

### Packaging (`packaging/`)

**`zip-packager.test.ts`**:
- Creates valid zip file
- Zip contains all files from output directory
- Files renamed to canonical names inside zip
- Empty output → valid zip (empty or minimal)
- Zip can be extracted and contents verified

**`tag-builder.test.ts`**:
- CC published → `cc-51015/ed1`
- CC WD → `cc-51015/ed2-wd`
- ISO published → `iso-8601-1-2019/ed1`
- ISO WD → `iso-wd-8601-1-2026/ed2-wd`
- IETF I-D → `id-calext-jscalendar/32`
- RFC → `rfc-8984/1`

### Publishing (`publishing/`)

**`github-release-publisher.test.ts`** — Mock Octokit:
- Create new release (no existing tag)
- Update draft release
- Skip published (immutable) release
- Upload asset
- Delete old asset on update
- Release body format: contains content-hash and metadata table
- Pre-release flag set correctly

### Pipeline (`pipeline.test.ts`)

Integration test with all components mocked:
- Happy path: 3 documents, 1 changed → 1 released, 2 skipped
- All unchanged → all skipped
- Force mode → all released
- One document fails → others continue, failed reported
- Visibility filter removes private docs
- Pattern filter narrows scope
- Empty site → 0 documents, no errors
- Compilation failure → pipeline fails

## Coverage Requirements

- Branch coverage: 80% (same as site-gen)
- Function coverage: 80%
- Line coverage: 80%
- All value object factory methods must have negative test cases
- All error paths must be tested
