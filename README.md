# Metanorma Release Action

A GitHub Action that publishes compiled Metanorma documents as **per-document GitHub Releases**.

Part of the [actions-mn ecosystem](https://github.com/actions-mn) — alongside [site-gen](https://github.com/actions-mn/site-gen), [compile](https://github.com/actions-mn/compile), and [build-and-publish](https://github.com/actions-mn/build-and-publish).

> **Note**: This action does **not** compile documents. Use [site-gen](https://github.com/actions-mn/site-gen) for compilation first, then run this action on the compiled output.

## Features

- **Per-document releases**: Each document gets its own tag, asset, and GitHub Release
- **Content-hash change detection**: Only re-releases documents whose compiled output actually changed
- **Immutable published releases**: Published tags are created once; draft tags are updated in-place
- **Visibility control**: Optional `metanorma.release.yml` to manage public/private documents
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
| `release-config` | Release manifest file (visibility filter) | No | `metanorma.release.yml` |
| `force` | Force release even if content hash matches last release | No | `false` |
| `include-pattern` | Glob pattern to filter documents for release (e.g. `cc-*`) | No | `*` |
| `token` | GitHub token for creating releases | No | `${{ github.token }}` |

## Outputs

| Output | Description |
|--------|-------------|
| `released-documents` | JSON array of released document identifiers |
| `skipped-documents` | JSON array of skipped document identifiers (unchanged) |
| `total-documents` | Total number of documents processed |

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

The `metanorma.release.yml` file controls which documents in a repo are eligible for public release. If this file is absent, all documents are released.

```yaml
# metanorma.release.yml
documents:
  - source: sources/cc-51015.adoc          # visibility: public (default)
  - source: sources/cc-51024.adoc
  - source: sources/cc-51026.adoc
    visibility: private                     # withheld from public release
```

| Value | Effect |
|-------|--------|
| `public` (default) | Document is packaged and released |
| `private` | Document is not released publicly |
| `members` | Reserved for future use (member-only access) |

## Change Detection

The action uses **content hashing** to avoid re-releasing unchanged documents:

1. SHA-256 hash all files in each document's output directory
2. Compare against the hash stored in the previous GitHub Release body
3. If the hash matches → skip (unchanged)
4. If the hash differs → package and release

The hash is stored in the first line of the release body: `content-hash:{sha256hex}`.

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
