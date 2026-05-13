# Metanorma Release Action

A GitHub Action that publishes compiled Metanorma documents as **per-document GitHub Releases**.

Part of the [actions-mn ecosystem](https://github.com/actions-mn) — alongside [site-gen](https://github.com/actions-mn/site-gen), [compile](https://github.com/actions-mn/compile), and [build-and-publish](https://github.com/actions-mn/build-and-publish).

> **Note**: This action does **not** compile documents. Use [site-gen](https://github.com/actions-mn/site-gen) for compilation first, then run this action on the compiled output.

## Features

- **Per-document releases**: Each document gets its own tag, asset, and GitHub Release
- **Channel-based publication**: Route documents to specific portals via `audience/category` channels
- **Pattern-based manifests**: Auto-assign channels by document ID pattern — zero per-document config
- **Stage gating**: Restrict releases to specific stages (e.g. only `published` documents)
- **Content-hash change detection**: Only re-releases documents whose compiled output actually changed
- **Immutable published releases**: Published tags are created once; draft tags are updated in-place
- **Selective force-replace**: Re-release specific documents without affecting others in the same repo
- **Universal flavor support**: Data-driven tag naming from RXL metadata — works with all Metanorma flavors
- **Parallel processing**: Fault-tolerant `Promise.allSettled` — one failure doesn't block others
- **TypeScript**: Written in TypeScript with full type safety and 80%+ test coverage

## Quick Start

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions-mn/site-gen@v1          # compile first
      - uses: actions-mn/release@v1           # then release
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

## How It Works

1. Discovers compiled documents from their RXL metadata files
2. Filters by visibility (from `metanorma.release.yml`) and include pattern
3. Detects changes (content hash vs. last release)
4. Packages each changed document as a zip
5. Publishes as per-document GitHub Releases

Downstream portals discover participating repos via the `metanorma-release` GitHub topic and aggregate released artifacts — no submodules, no compilation needed on the index side.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `source-path` | Source path containing the metanorma configuration | No | `.` |
| `output-dir` | Output directory containing compiled documents | No | `_site` |
| `release-config` | Release manifest file | No | `metanorma.release.yml` |
| `default-visibility` | Default visibility for unlisted documents (`public`, `private`, `members`) | No | `public` |
| `force` | Force release even if content hash matches last release | No | `false` |
| `force-replace` | Comma-separated doc IDs or glob patterns to force-replace | No | `''` |
| `include-pattern` | Glob pattern to filter documents for release (e.g. `cc-*`) | No | `*` |
| `stages` | Comma-separated stages to release. Empty = all. | No | `''` |
| `channels` | Override channels for all documents. Empty = use manifest. | No | `''` |
| `concurrency` | Max parallel document processing | No | `4` |
| `token` | GitHub token for creating releases | No | `${{ github.token }}` |

## Outputs

| Output | Description |
|--------|-------------|
| `released-documents` | JSON array of released document identifiers |
| `skipped-documents` | JSON array of skipped document identifiers (unchanged) |
| `failed-documents` | JSON array of failed document identifiers |
| `total-documents` | Total number of documents processed |
| `released-artifacts` | JSON array of `{ id, tag, url, channels }` for released documents |

## Usage Examples

### Multi-document repo with visibility control

Add a `metanorma.release.yml` to control which documents are publicly released:

```yaml
# metanorma.release.yml
documents:
  - source: sources/cc-51015.adoc
  - source: sources/cc-51024.adoc
  - source: sources/cc-51026.adoc
    visibility: private  # not ready for public release
```

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [main]
    paths: ['sources/**', 'metanorma.yml', 'metanorma.release.yml']

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions-mn/site-gen@v1
      - uses: actions-mn/release@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Explicit release via tag signal

Push a `release/*` tag to trigger a forced release:

```yaml
# .github/workflows/release.yml
on:
  push:
    tags: ['release/**']

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions-mn/site-gen@v1
      - uses: actions-mn/release@v1
        with:
          force: true
          token: ${{ secrets.GITHUB_TOKEN }}
```

## Naming Strategy Design

Tag and asset naming is determined by **naming behavior**, not publisher identity. Strategies are named after what they DO (how they format tags), not WHO they're for (which SDO published the document).

### Why not publisher-specific strategies?

Publisher-based naming (`IeeeNamingStrategy`, `IhoNamingStrategy`, `OgcNamingStrategy`) is wrong for several reasons:

1. **Publisher ≠ naming convention.** The naming convention is determined by the identifier format and edition format, not the publisher's identity. IHO and OGC use identical version-based naming — giving them separate classes duplicates identical behavior.

2. **One publisher, multiple conventions.** IEEE uses `DraftSuffixNamingStrategy` for draft identifiers (extracting `-d{N}`) but falls back to `EditionNamingStrategy` for published documents. A single "IEEE strategy" would conflate two behaviors into one class.

3. **Wrong abstraction level.** The strategy pattern should abstract over the WHAT (how to format a tag), not the WHO (which publisher). `EditionNamingStrategy` describes behavior. `IeeeNamingStrategy` describes an organization.

4. **Unnecessary enum proliferation.** Most publishers (ISO, IEC, ITU, BIPM, OIML, UN, CSA, etc.) all use edition-based naming. Creating `DocumentType.Iso`, `DocumentType.Iec`, etc. purely to dispatch to the same strategy adds complexity without value.

### Strategy Behavior Table

| Strategy | Tag format | Asset format | Used by |
|---|---|---|---|
| `EditionNamingStrategy` | `{id}/ed{N}[-{stage}]` | `{id}-ed{N}[-{stage}].zip` | CC, ISO, IEC, ITU, BIPM, OIML, UN, CSA, M3AAWG, MPFA, PDFA, Ribose, unknown |
| `VersionNamingStrategy` | `{id}/v{N}` | `{id}-v{N}.zip` | IHO, OGC |
| `InternetDraftNamingStrategy` | `id-{name}/{draftN}` | `draft-ietf-{name}-{draftN}.zip` | IETF Internet-Drafts |
| `RfcNamingStrategy` | `{id}/ed{N}` | `{id}.zip` | IETF RFCs |
| `DraftSuffixNamingStrategy` | `{base}/{N}` (from `-d{N}` suffix) | `{id}.zip` | IEEE Drafts |

### Dispatch

`DocumentType` (detected from identifier prefix) maps to a naming strategy in `createDefaultRegistry()`. Multiple `DocumentType` values can map to the same strategy instance — e.g., `Iho` and `Ogc` share one `VersionNamingStrategy`.

## Release Tag Convention

Each document gets its own release tag and asset, independent of other documents in the same repo. Tag naming is **data-driven** from RXL metadata — normalized docidentifier + edition + stage — so it works for any Metanorma flavor without special-casing.

| Document | Stage | Tag | Asset | Strategy |
|---|---|---|---|---|
| CC standard | Published | `cc-51015/ed1` | `cc-51015-ed1.zip` | Edition |
| CC standard | Working Draft | `cc-51015/ed2-wd` | `cc-51015-ed2-wd.zip` | Edition |
| ISO | Published | `iso-8601-1-2019/ed1` | `iso-8601-1-2019-ed1.zip` | Edition |
| ISO | WD | `iso-wd-8601-1-2026/ed2-wd` | `iso-wd-8601-1-2026-ed2-wd.zip` | Edition |
| IETF I-D | — | `id-calext-jscalendar/32` | `draft-ietf-calext-jscalendar-32.zip` | InternetDraft |
| IETF RFC | Published | `rfc-8984/ed1` | `rfc-8984.zip` | Rfc |
| IEEE Draft | — | `ieee-draft-std-987-6-2020/3` | `ieee-draft-std-987-6-2020-d3.zip` | DraftSuffix |
| IHO | Published | `s-102/v2.1.0` | `s-102-v2.1.0.zip` | Version |
| OGC | Published | `17-069r3/v1.0` | `17-069r3-v1.0.zip` | Version |

> Published releases are **immutable** — the tag is created once and never overwritten.
> Draft releases are **rolling** — the same tag is updated in-place as the draft evolves.

## Release Manifest

The `metanorma.release.yml` file controls which documents in a repo are eligible for release, their channels, and stage constraints. If this file is absent, all documents are released.

### Pattern-based channel assignment

Use `pattern` to auto-assign channels by document ID:

```yaml
# metanorma.release.yml
documents:
  - pattern: "cc-s-*"
    channels: [public/standards]
  - pattern: "cc-r-*"
    channels: [public/reports]
  - pattern: "cc-a-*"
    channels: [public/admin]
```

When an author adds a new document like `cc-s-51020`, the pattern `cc-s-*` automatically assigns it to `public/standards`. No manifest update needed.

### Exact source matching

For single-document repos or exceptions, use `source`:

```yaml
documents:
  - source: sources/cc-10001.adoc
    channels: [public/directives]
```

### Stage gating

Restrict releases to specific stages:

```yaml
documents:
  - pattern: "cc-s-*"
    stages: [published]        # only published stage creates a release
    channels: [public/standards]
```

Working drafts and committee drafts never create a GitHub Release with this constraint.

### Visibility

| Value | Effect |
|-------|--------|
| `public` (default) | Document is packaged and released |
| `private` | Document is not released publicly |
| `members` | Reserved for future use (member-only access) |

When a manifest exists but a document doesn't match any pattern or source, it defaults to the `default-visibility` input (default: `public`).

## Change Detection

The action uses **content hashing** to avoid re-releasing unchanged documents:

1. SHA-256 hash all files in each document's output directory
2. Compare against the hash stored in the previous GitHub Release body
3. If the hash matches → skip (unchanged)
4. If the hash differs → package and release

The hash is stored in the first line of the release body: `content-hash:{sha256hex}`.

## Channels

A channel is an `audience/category` pair that determines where a document appears:

- **audience**: `public`, `members`, or `internal` — who can see it
- **category**: free-form identifier — where it appears in the portal

```
public/standards        ← published standards, visible to everyone
public/reports          ← conference and technical reports
members/internal-review ← only visible to organization members
internal/working-draft  ← never aggregated by any external portal
```

The publisher sets the channel. The aggregator (downstream portal) filters by it. A portal **cannot** override or discover channels the publisher didn't assign.

## Force-replacing releases

Published releases are immutable by default — the action will not overwrite an existing release. To selectively re-release a specific document (e.g. to fix bad metadata), use the `force-replace` input:

```yaml
- uses: actions-mn/release@v1
  with:
    force-replace: 'cc-s-51015'       # exact doc ID
    # or: force-replace: 'cc-s-*'     # glob pattern
    token: ${{ secrets.GITHUB_TOKEN }}
```

Only matched documents are deleted and recreated. Other documents in the same repo are completely unaffected.

## Release metadata

Each GitHub Release carries structured metadata in its body for downstream consumers:

```
content-hash:abc123...

<!-- mn-release-metadata
{"version":1,"id":"cc-s-51015","channels":["public/standards"],
 "stage":"published","edition":"1","title":"My Standard"}
 -->

## CC/S 51015

| Field | Value |
|---|---|
| Document | cc-s-51015 |
| Edition | 1 |
| Status | published |
| Channels | public/standards |
```

The `mn-release-metadata` JSON block (inside an HTML comment) is parsed by [`actions-mn/aggregate`](https://github.com/actions-mn/aggregate) for channel filtering and indexing.

## Discovery via GitHub Topics

Add the `metanorma-release` topic to your repository to opt in to portal discovery:

```bash
gh api repos/{owner}/{repo}/topics -X PUT --field names='["metanorma-release"]'
```

Portals discover participating repositories:

```bash
curl "https://api.github.com/search/repositories?q=topic:metanorma-release+org:CalConnect"
```

## Architecture

The action follows a pipeline pattern with pluggable interfaces at each stage:

```
Discover → Filter → Detect → Package → Publish
  (RXL)   (manifest)  (hash)   (zip)   (GitHub)
```

Each stage is defined by an interface (`IDocumentExtractor`, `IVisibilityFilter`, `IChangeDetector`, `IArtifactPackager`, `IReleasePublisher`), making the pipeline extensible without modifying existing code.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
