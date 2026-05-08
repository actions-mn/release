# 11: Documentation & Usage Examples

> **Status: COMPLETED** — README.adoc and action.yml documentation written. Usage examples in TODO.initial/11.

## Goal

README, action.yml documentation, and usage examples that cover common patterns for CC, ISO, and generic metanorma repos.

## README.md Structure

```markdown
# actions-mn/release

Compile and release Metanorma documents as per-document GitHub Releases.

## How It Works

1. Compiles all documents via `metanorma site generate`
2. Discovers compiled documents from RXL files
3. Filters by visibility (from `metanorma.release.yml`)
4. Detects changes (content hash vs. last release)
5. Packages each changed document as a zip
6. Publishes as per-document GitHub Releases

## Usage

### Basic (single document repo)

​```yaml
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
​```

### Multi-document repo with visibility control

​```yaml
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
​```

With `metanorma.release.yml`:
​```yaml
documents:
  - source: sources/cc-51015.adoc
  - source: sources/cc-51024.adoc
  - source: sources/cc-51026.adoc
    visibility: private
​```

### Explicit release via tag signal

​```yaml
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
​```

### Combined: auto-detect on push + explicit on tag

​```yaml
on:
  push:
    branches: [main]
    paths: ['sources/**', 'metanorma.yml']
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
        with:
          fetch-depth: 0
      - uses: actions-mn/release@v1
        with:
          agree-to-terms: true
          token: ${{ secrets.GITHUB_TOKEN }}
          force: ${{ startsWith(github.ref, 'refs/tags/release/') }}
​```

## Inputs (reference table)

| Input | Default | Description |
|---|---|---|
| `source-path` | `.` | Source path |
| `config-file` | `metanorma.yml` | Metanorma config file |
| `release-config` | `metanorma.release.yml` | Release manifest |
| `output-dir` | `_site` | Compiled output directory |
| `agree-to-terms` | `true` | Agree to font licenses |
| `force` | `false` | Force release all documents |
| `include-pattern` | `*` | Glob filter on doc-id |
| `token` | `${{ github.token }}` | GitHub token |

## Outputs

| Output | Description |
|---|---|
| `released-documents` | JSON array of released doc identifiers |
| `skipped-documents` | JSON array of skipped doc identifiers |
| `total-documents` | Total documents processed |

## Release Tag Convention

| Document | Edition | Stage | Tag |
|---|---|---|---|
| CC Standard | 1.0 | Published | `cc-51015/ed1.0` |
| CC Standard | 2.0 | Working Draft | `cc-51015/ed2.0-wd` |
| ISO | 1 | Published | `iso-8601-1-2019/ed1.0` |
| ISO | 2 | WD | `iso-wd-8601-1-2026/ed2.0-wd` |
| IETF I-D | — | — | `id-calext-jscalendar/32` |

## Discovery via GitHub Topics

Add the `metanorma-release` topic to your repo to opt-in to portal discovery:

​```bash
gh api repos/{owner}/{repo}/topics -X PUT -f names='["metanorma-release"]'
​```

Portals discover participating repos:
​```bash
curl "https://api.github.com/search/repositories?q=topic:metanorma-release+org:{org}"
​```
```

## LICENSE

MIT — same as all `actions-mn` actions.
