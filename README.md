# Metanorma Release Action

A GitHub Action that compiles Metanorma documents and publishes them as **per-document GitHub Releases**.

Part of the [actions-mn ecosystem](https://github.com/actions-mn) — alongside [site-gen](https://github.com/actions-mn/site-gen), [compile](https://github.com/actions-mn/compile), and [build-and-publish](https://github.com/actions-mn/build-and-publish).

## Features

- **Per-document releases**: Each document gets its own tag, asset, and GitHub Release
- **Content-hash change detection**: Only re-releases documents whose compiled output actually changed
- **Immutable published releases**: Published tags are created once; draft tags are updated in-place
- **Visibility control**: Optional `metanorma.release.yml` to manage public/private documents
- **IETF + ISO + CC support**: Strategy-based tag naming for all document types
- **Parallel processing**: Fault-tolerant `Promise.allSettled` — one failure doesn't block others
- **TypeScript**: Written in TypeScript with full type safety and 92%+ test coverage

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
    container: metanorma/metanorma:latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions-mn/release@v1
        with:
          agree-to-terms: true
          token: ${{ secrets.GITHUB_TOKEN }}
```

## How It Works

1. Compiles all documents via `metanorma site generate`
2. Discovers compiled documents from their RXL metadata
3. Filters by visibility (from `metanorma.release.yml`)
4. Detects changes (content hash vs. last release)
5. Packages each changed document as a zip
6. Publishes as per-document GitHub Releases

Downstream portals discover participating repos via the `metanorma-release` GitHub topic and aggregate released artifacts — no submodules, no compilation needed on the index side.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `source-path` | Source path containing the metanorma configuration | No | `.` |
| `config-file` | Metanorma configuration file name | No | `metanorma.yml` |
| `release-config` | Release manifest file (visibility filter) | No | `metanorma.release.yml` |
| `output-dir` | Output directory for compiled documents | No | `_site` |
| `agree-to-terms` | Agree to all third-party licensing terms (fonts) | No | `true` |
| `install-fonts` | Install missing fonts automatically | No | `true` |
| `continue-without-fonts` | Continue processing even when fonts are missing | No | `true` |
| `use-bundler` | Use bundler to execute metanorma | No | `false` |
| `force` | Force release even if content hash matches last release | No | `false` |
| `include-pattern` | Glob pattern to filter documents for release (e.g. `cc-*`) | No | `*` |
| `token` | GitHub token for creating releases | Yes | `${{ github.token }}` |

## Outputs

| Output | Description |
|--------|-------------|
| `released-documents` | JSON array of released document identifiers |
| `skipped-documents` | JSON array of skipped document identifiers (unchanged) |
| `total-documents` | Total number of documents processed |
| `metanorma-version` | Version of metanorma used for compilation |

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
    container: metanorma/metanorma:latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions-mn/release@v1
        with:
          agree-to-terms: true
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
    container: metanorma/metanorma:latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions-mn/release@v1
        with:
          agree-to-terms: true
          force: true
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Using with Bundler

```yaml
- name: Install dependencies
  run: bundle install

- uses: actions-mn/release@v1
  with:
    use-bundler: true
    agree-to-terms: true
    token: ${{ secrets.GITHUB_TOKEN }}
```

## Release Tag Convention

Each document gets its own release tag and asset, independent of other documents in the same repo.

| Document type | Stage | Tag | Asset |
|---|---|---|---|
| CC standard | Published | `cc-51015/ed1.0` | `cc-51015-ed1.0.zip` |
| CC standard | Working Draft | `cc-51015/ed2.0-wd` | `cc-51015-ed2.0-wd.zip` |
| CC standard | Committee Draft | `cc-51015/ed2.0-cd` | `cc-51015-ed2.0-cd.zip` |
| ISO | Published (60.60) | `iso-8601-1-2019/ed1.0` | `iso-8601-1-2019-ed1.0.zip` |
| ISO | WD (20.20) | `iso-wd-8601-1-2026/ed2.0-wd` | `iso-wd-8601-1-2026-ed2.0-wd.zip` |
| IETF I-D | — | `id-calext-jscalendar/32` | `draft-ietf-calext-jscalendar-32.zip` |
| IETF RFC | Published | `rfc-8984/1` | `rfc-8984.zip` |

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
| `public` (default) | Document is compiled, packaged, and released |
| `private` | Document is compiled but not released publicly |
| `members` | Reserved for future use (member-only access) |

## Change Detection

The action uses **content hashing** to avoid re-releasing unchanged documents:

1. After compilation, SHA-256 hash all files in each document's output directory
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
Compile → Discover → Filter → Detect → Package → Publish
(site-gen)  (RXL)   (manifest) (hash)  (zip)   (GitHub)
```

Each stage is defined by an interface (`IDocumentExtractor`, `IVisibilityFilter`, `IChangeDetector`, `IArtifactPackager`, `IReleasePublisher`, `ICompiler`), making the pipeline extensible without modifying existing code.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
