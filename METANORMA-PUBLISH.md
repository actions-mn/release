# Metanorma Publication Architecture

This document describes the architecture of the Metanorma publication system —
the end-to-end flow from authoring a document to its appearance on a public
portal.

## System overview

The Metanorma publication system consists of four components:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Author     │     │  CI/CD       │     │  GitHub      │     │  Portal      │
│              │     │              │     │  Releases     │     │              │
│  sources/    │────►│ actions-mn/  │────►│              │────►│ actions-mn/  │
│  *.adoc      │     │ site-gen     │     │  per-document │     │ aggregate    │
│              │     │ + release    │     │  releases     │     │              │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                          pipeline              channel               index
                           role               metadata store            role
```

| Component | Action | Repo |
|---|---|---|
| `actions-mn/site-gen` | Compiles AsciiDoc → HTML/PDF/XML/RXL | Per-document repo |
| `actions-mn/release` | Publishes compiled docs as GitHub Releases | Per-document repo |
| GitHub Releases | Stores per-document release artifacts + metadata | GitHub |
| `actions-mn/aggregate` | Discovers, filters, downloads, indexes released docs | Portal repo |

## Publication flow

```
Author pushes to main
         │
         ▼
┌─────────────────────┐
│ actions-mn/site-gen │  Compile AsciiDoc → HTML, PDF, XML, RXL
└────────┬────────────┘
         │  _site/ output
         ▼
┌─────────────────────┐
│ actions-mn/release  │  Discover → Filter → Detect → Package → Publish
│                     │
│  1. Extract RXL     │  Parse document metadata (ID, title, stage, edition)
│  2. Load manifest   │  metanorma.release.yml → channel + visibility policy
│  3. Filter          │  Channel manifest + pattern + stage filters
│  4. Detect changes  │  Content hash vs. last release
│  5. Package         │  Zip with canonical filenames
│  6. Publish         │  Create/update GitHub Release with metadata
└────────┬────────────┘
         │  GitHub Release per document
         ▼
┌──────────────────────────────────────────────────────┐
│                   GitHub Releases                     │
│                                                      │
│  Release body:                                       │
│  ┌────────────────────────────────────────────┐     │
│  │ content-hash:abc123...                     │     │
│  │                                            │     │
│  │ <!-- mn-release-metadata                   │     │
│  │ {"version":1,"id":"cc-s-51015",            │     │
│  │  "channels":["public/standards"],...}       │     │
│  │ -->                                        │     │
│  │                                            │     │
│  │ ## CC/A 51015                              │     │
│  │ | Channels | public/standards |            │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  Assets: cc-s-51015-ed1.zip (HTML+PDF+XML+RXL)      │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌─────────────────────────┐
│ actions-mn/aggregate    │  Discover → Manifest → ETag → Filter →
│                         │  Dedup → Download → Extract → Index
│                         │
│  1. Discover repos      │  Topic search or explicit list
│  2. Check manifest      │  .metanorma/channels.yml → skip if no overlap
│  3. Fetch releases      │  Paginated, with ETag caching
│  4. Parse metadata      │  mn-release-metadata JSON from release body
│  5. Filter              │  Channel + stage matching
│  6. Dedup               │  Content-hash comparison → skip unchanged
│  7. Download + extract  │  Zip → files, canonicalize filenames
│  8. Route files         │  flat / by-doctype / by-format
│  9. Generate index      │  index.json with full document metadata
│ 10. Save delta state    │  Persist for incremental runs
└────────┬────────────────┘
         │  _site/cc/ with index.json
         ▼
┌─────────────────────┐
│ Portal (Jekyll/etc) │  Render HTML pages from aggregated documents
└─────────────────────┘
```

## Channel system

### What channels solve

Without channels, all releases go to a single stream. A portal must download
every release from every repo to determine relevance. Channels add a routing
layer:

- **Authors** declare *where* a document goes (channel assignment)
- **Portals** declare *what* they want (channel subscription)
- The system ensures documents only appear on the intended portals

### Channel format

```
audience/category

public/standards        ← public audience, standards category
members/internal-review ← members audience, internal-review category
internal/working-draft  ← internal audience, never aggregated
```

- **audience**: `public`, `members`, or `internal` — determines access scope
- **category**: free-form identifier — determines routing within a portal

### Channel flow

```
metanorma.release.yml          Release body              Aggregate input
(per-repo)                     (per-release)             (per-portal)

pattern: "cc-s-*"  ──►  channels:["public/standards"]  ──►  channels:
channels:                 in mn-release-metadata              public/standards,
[public/standards]                                            public/reports
```

The publisher sets the channel. The aggregator filters by it. The aggregator
cannot override or discover channels the publisher didn't assign.

### CalConnect channel registry

| Channel | Audience | Document IDs | Description |
|---|---|---|---|
| `public/standards` | Public | `cc-s-*` | Published CalConnect Standards |
| `public/reports` | Public | `cc-r-*` | Conference, roundtable, IOP test reports |
| `public/admin` | Public | `cc-a-*` | Administrative documents |
| `public/advisories` | Public | `cc-adv-*` | Advisories |
| `public/directives` | Public | `cc-dir-*` | CalConnect directives |

## Safety model

The system has three defense layers against document leaks:

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Publisher gate (manifest)                           │
│                                                             │
│   metanorma.release.yml with no defaults section            │
│   → unmatched documents = private (not released)            │
│   → default-visibility: private in workflow                 │
│                                                             │
│   "If it's not in the manifest, it doesn't exist."          │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Channel assignment (release action)                │
│                                                             │
│   Pattern → channel mapping is authoritative                │
│   Aggregator cannot reassign or discover unassigned docs    │
│                                                             │
│   "The publisher decides the channel. Period."              │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Aggregation filter (aggregate action)              │
│                                                             │
│   Portal declares which channels it wants                   │
│   Only matching releases are included                       │
│   Legacy releases (no metadata) always included             │
│                                                             │
│   "The portal sees only what it asks for."                  │
└─────────────────────────────────────────────────────────────┘
```

### Critical rule: no defaults

```yaml
# SAFE: no defaults section
# Unmatched documents → private → not released
documents:
  - pattern: "cc-s-*"
    channels: [public/standards]

# DANGEROUS: defaults.visibility: public
# Unmatched documents → public → released to public/default
defaults:
  visibility: public
documents:
  - pattern: "cc-s-*"
    channels: [public/standards]
```

## Manifest design

### Pattern-based (recommended)

Channel is inferred from the document ID convention. Authors don't need to
update the manifest when adding new documents.

```yaml
# metanorma.release.yml
documents:
  - pattern: "cc-s-*"
    channels: [public/standards]
  - pattern: "cc-r-*"
    channels: [public/reports]
```

How it works:

```
Document compiled: cc-s-51015 (stage: published)
         │
         ▼
Manifest.resolve("cc-s-51015")
  → pattern "cc-s-*" matches (score: 55)
  → channels: [public/standards]
  → shouldRelease: true
         │
         ▼
Release created with metadata:
  channels: ["public/standards"]
```

```
Document compiled: cc-internal-notes (stage: published)
         │
         ▼
Manifest.resolve("cc-internal-notes")
  → no pattern matches
  → effectiveVisibility: private
  → shouldRelease: false
         │
         ▼
No release created. Document stays internal.
```

### Source-based (for single-doc repos or exceptions)

```yaml
documents:
  - source: sources/cc-10001.adoc
    channels: [public/directives]
```

Source paths take priority over patterns (score 100 vs 50+length), allowing
per-document overrides:

```yaml
documents:
  # General rule
  - pattern: "cc-s-*"
    channels: [public/standards]

  # Exception: this specific doc is not ready
  - source: sources/cc-s-51015/document.adoc
    visibility: private
```

### Stage-gated release

Add `stages` to restrict which publication stages trigger a release:

```yaml
documents:
  - pattern: "cc-s-*"
    stages: [published]
    channels: [public/standards]
```

With this constraint, working drafts and committee drafts are never released —
no GitHub Release is created until the document reaches the `published` stage.

## Caching and incremental aggregation

```
┌──────────────┐    ETag unchanged     ┌──────────────┐
│  Run N       │ ────────────────────  │  Run N+1     │
│              │                       │              │
│  Fetch repos │    Content hash       │  Fetch repos │
│  Fetch rels  │    unchanged          │  ETag match  │ ──► Skip repo
│  Download    │ ────────────────────  │  Hash match  │ ──► Skip release
│  Extract     │                       │  Download    │ ──► Only changed
│  Index       │                       │  Extract     │
│  Save state  │                       │  Index       │
└──────────────┘                       └──────────────┘
```

When `cache-dir` is set, `actions-mn/aggregate` uses three caching mechanisms:

1. **ETags**: Skip repos whose release list hasn't changed (HTTP 304)
2. **Content hashes**: Skip re-downloading releases with unchanged content
3. **Delta state**: Track processed releases per repo, clean up stale files

## File routing

`actions-mn/aggregate` supports three output structures:

```
flat (default):           by-doctype:              by-format:
_site/cc/                 _site/cc/                _site/cc/
├── cc-s-51015.html       ├── standard/            ├── html/
├── cc-s-51015.pdf        │   ├── cc-s-51015.html  │   ├── cc-s-51015.html
└── cc-s-51015.xml        │   ├── cc-s-51015.pdf   ├── pdf/
                          │   └── cc-s-51015.xml    │   └── cc-s-51015.pdf
                          └── report/               └── xml/
                              └── cc-r-0602.html        └── cc-s-51015.xml
```

## Index format

The aggregation output includes a structured JSON index:

```json
{
  "version": 1,
  "generatedAt": "2026-05-13T00:00:00Z",
  "parameters": {
    "organizations": ["CalConnect"],
    "channels": ["public/standards", "public/reports"],
    "topic": "metanorma-release"
  },
  "summary": {
    "repoCount": 3,
    "documentCount": 33,
    "channelsFound": ["public/standards", "public/reports", "public/admin"]
  },
  "documents": [
    {
      "id": "cc-s-51015",
      "title": "CalConnect Standard 51015",
      "channels": ["public/standards"],
      "files": [
        {"name": "cc-s-51015.html", "path": "cc-s-51015.html"},
        {"name": "cc-s-51015.pdf", "path": "cc-s-51015.pdf"}
      ]
    }
  ]
}
```

## Error handling

```
Repo A ──► 10 releases ──► 8 included, 1 skipped, 1 error ──► partial success
Repo B ──► 5 releases  ──► all included                    ──► success
Repo C ──► API error   ──► 0 processed                     ──► failed (in report)

Result:
  documents: [13 from A, 5 from B]
  failedRepos: []  (unless fail-on-error: true)
  report: { A: {errors: [{tag: "x", message: "..."}]}, B: {}, C: {reason: "API error"} }
```

Individual repo/release failures don't stop aggregation. The `fail-on-error`
input can be set to `true` to fail the action when any error occurs.
