# Release Action Specification

## 1. Configuration Concerns (MECE)

There are five distinct configuration concerns in the `actions-mn` ecosystem. Each belongs to exactly one file, owned by exactly one authority. No overlap, no gaps.

### 1.1 Metanorma compilation — `metanorma.yml`

**Authority**: Metanorma CLI (owned by the metanorma project, not by actions-mn)

**Purpose**: Tells `metanorma site generate` what to compile.

```yaml
# metanorma.yml
metanorma:
  source:
    files:
      - sources/cc-51015/document.adoc
      - sources/cc-51024/document.adoc
  collection:
    organization: "CalConnect"
    name: "CC Standards"
```

**Contains**: source file list, collection metadata. Nothing about releases, visibility, or deployment.

**Consumed by**: `site-gen` action (compilation). `release` action never reads this file.

### 1.2 Release policy — `metanorma.release.yml`

**Authority**: Repository maintainer (the document author)

**Purpose**: Declares which documents are eligible for public release and their visibility.

```yaml
# metanorma.release.yml
documents:
  - source: sources/cc-51015/document.adoc
  - source: sources/cc-51024/document.adoc
  - source: sources/cc-51026/document.adoc
    visibility: private
  - source: sources/draft-ietf-calext-jscalendar-32/document.adoc
```

**Contains**: document source paths with visibility flags.

**Rules**:
- If absent → all compiled documents are treated as public (backward compatible).
- If present but empty → no documents are public (explicit opt-in).
- `source` must match the path in `metanorma.yml`'s `source.files`.
- `visibility` values: `public` (default), `private`, `members` (reserved).
- Documents not listed in this file when it exists are treated as `private`.

**Consumed by**: `release` action only (visibility filtering).

### 1.3 Compilation inputs — `site-gen` action inputs

**Authority**: CI workflow author

**Purpose**: Controls how metanorma compiles (not what it compiles — that's `metanorma.yml`).

| Input | Default | Purpose |
|---|---|---|
| `source-path` | `.` | Where to find `metanorma.yml` |
| `output-dir` | `_site` | Where compiled output goes |
| `config-file` | `metanorma.yml` | Metanorma config filename |
| `agree-to-terms` | `false` | Accept font licenses |
| `install-fonts` | `true` | Auto-install fonts |
| `continue-without-fonts` | `true` | Proceed despite missing fonts |
| `strict` | `false` | Fail on warnings |
| `progress` | `false` | Show progress logs |
| `use-bundler` | `false` | Run via `bundle exec` |
| `timestamps` | `false` | Add timestamps to logs |

**Owned by**: `site-gen` action. `release` action does NOT accept any of these.

### 1.4 Release inputs — `release` action inputs

**Authority**: CI workflow author

**Purpose**: Controls release behavior — what gets released, how, and where.

| Input | Default | Purpose |
|---|---|---|
| `source-path` | `.` | Where to find `metanorma.release.yml` |
| `output-dir` | `_site` | Where site-gen put compiled output |
| `release-config` | `metanorma.release.yml` | Release manifest filename |
| `force` | `false` | Release even if content unchanged |
| `include-pattern` | `*` | Glob filter on document ID (e.g. `cc-*`) |
| `token` | `${{ github.token }}` | GitHub token for Releases API |

**Owned by**: `release` action. No compilation inputs.

**Note on `source-path` and `output-dir`**: These must match what was passed to `site-gen` so `release` can locate both the manifest and the compiled output. In the common case both default to `.` and `_site`, requiring no explicit configuration.

### 1.5 Deployment target — workflow-level concern

**Authority**: CI workflow author

**Purpose**: Where the output goes after compilation.

| Target | Action |
|---|---|
| GitHub Pages | `actions/deploy-pages` (after `site-gen`) |
| GitHub Releases | `release` action (after `site-gen`) |
| Both | `site-gen` then `release` then `deploy-pages` |
| Artifact upload | `actions/upload-artifact` |

This is not an action input — it's workflow composition. No new action needed.

---

## 2. `release` Action Specification

### 2.1 Scope

The `release` action discovers compiled Metanorma documents, detects which have changed since their last release, packages changed documents into zip artifacts, and publishes them as per-document GitHub Releases. It does NOT compile — compilation is `site-gen`'s responsibility.

### 2.2 Pipeline

```
site-gen output → Discover → Filter → Detect → Package → Publish
                   (RXL)   (manifest) (hash)  (zip)   (GitHub)
```

Each stage is an interface. Default implementations live in their respective directories.

### 2.3 Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `source-path` | path | `.` | Directory containing `metanorma.release.yml` and the metanorma project. Must match the `source-path` passed to `site-gen`. |
| `output-dir` | path | `_site` | Directory containing compiled output (relative to `source-path`). Must match the `output-dir` passed to `site-gen`. |
| `release-config` | filename | `metanorma.release.yml` | Release manifest filename. |
| `force` | boolean | `false` | When `true`, release all documents regardless of content hash changes. |
| `include-pattern` | glob | `*` | Minimatch glob filter on document IDs. Only matching documents are considered for release. |
| `token` | string | `${{ github.token }}` | GitHub token with `contents: write` permission. Required. |

### 2.4 Outputs

| Output | Type | Description |
|---|---|---|
| `released-documents` | JSON string | Array of released document ID strings (e.g. `["cc-51015","cc-51024"]`). |
| `skipped-documents` | JSON string | Array of skipped document ID strings (content unchanged). |
| `total-documents` | number | Total documents processed (released + skipped + failed). |

### 2.5 Behavior

#### Step 1: Discover

- Glob for `**/*.rxl` in `{source-path}/{output-dir}`.
- Parse each RXL file to extract: docidentifier, edition, stage, title, doctype, revdate, output formats.
- Normalize docidentifier to kebab-case via `DocumentId.fromRaw()`.
- Detect document type (Standard, IetfDraft, IetfRfc) from identifier pattern.
- Skip malformed RXL files with a warning, continue with valid ones.

#### Step 2: Filter (visibility)

- Load `metanorma.release.yml` from `{source-path}/{release-config}`.
- If file not found → treat all documents as public.
- If file found → only documents listed with `visibility: public` (or no visibility, defaulting to public) pass the filter.
- Documents not listed when the file exists are treated as `private`.

#### Step 3: Filter (pattern)

- Apply `include-pattern` glob against document IDs.
- `*` (default) passes all documents.
- Pattern uses minimatch semantics.

#### Step 4: Detect changes

- For each surviving document, compute SHA-256 content hash of all files in its output directory (excluding `.hash` files).
- Fetch previous release for the computed tag via GitHub Releases API.
- Extract `content-hash:{hex}` from the release body (first line).
- If no previous release exists → changed (new document).
- If previous hash differs from current → changed.
- If hashes match → unchanged (skip).
- On API error (non-404) → fail open (treat as changed, log warning).
- If `force: true` → skip hash comparison, treat all as changed.

#### Step 5: Package

- Create a zip archive of the document's output directory.
- Rename files to canonical names: `{docId}-{version}.{ext}` (e.g. `cc-51015-ed1.pdf`).
- Store in system temp directory.
- Return artifact path and size.

#### Step 6: Publish

- Compute release tag from document metadata via naming strategy:
  - **Standard**: `{docId}/{version}` (e.g. `cc-51015/ed1`)
  - **IETF I-D**: `id-{org}-{name}/{draftVersion}` (e.g. `id-calext-jscalendar/32`)
  - **IETF RFC**: `{docId}/{version}` (e.g. `rfc-8984/1`)
- If no existing release → create GitHub Release with tag, body (content hash + metadata table), and zip asset.
- If existing **published** release (non-prerelease) and current is also published → **skip** (immutable). Log warning.
- If existing **draft** release → update in-place: replace body, delete old assets, upload new asset (rolling).
- Release body first line: `content-hash:{sha256hex}`. Remainder: markdown metadata table.

#### Step 7: Process results

- Process all documents in parallel via `Promise.allSettled`.
- One document's failure does not block others.
- Aggregate into released, skipped, failed lists.
- If any failed → set action status to failed with summary message.

### 2.6 Error handling

| Scenario | Behavior |
|---|---|
| No RXL files found | Log info, succeed with empty results |
| Malformed RXL file | Log warning, skip that document |
| Release manifest missing | Treat all documents as public |
| Release manifest invalid YAML | Fail the action |
| Previous release fetch fails (non-404) | Fail open, release anyway |
| Published release already exists | Skip with warning |
| Asset upload fails | Document marked as failed |
| Any document failure | Continue others, fail action at end |

### 2.7 Tag naming

| Document type | Example identifier | Tag | Asset |
|---|---|---|---|
| CC published | CC 51015 | `cc-51015/ed1` | `cc-51015-ed1.zip` |
| CC draft | CC 51015 | `cc-51015/ed2-wd` | `cc-51015-ed2-wd.zip` |
| ISO published | ISO 8601-1:2019 | `iso-8601-1-2019/ed1` | `iso-8601-1-2019-ed1.zip` |
| ISO draft | ISO/WD 8601-1:2026 | `iso-wd-8601-1-2026/ed2-wd` | `iso-wd-8601-1-2026-ed2-wd.zip` |
| IETF I-D | draft-ietf-calext-jscalendar-32 | `id-calext-jscalendar/32` | `draft-ietf-calext-jscalendar-32.zip` |
| IETF RFC | RFC 8984 | `rfc-8984/1` | `rfc-8984.zip` |

### 2.8 Security

- Path inputs validated against traversal (`..`) and absolute paths outside workspace.
- Filename inputs validated against special characters.
- Token validated as non-empty.
- All lengths capped (paths: 255, filenames: 100).

---

## 3. Workflow Patterns

### 3.1 Release only (compilation done elsewhere)

```yaml
- uses: actions-mn/release@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
```

### 3.2 Compile + release (standard pattern)

```yaml
- uses: actions-mn/cache@v1
- uses: actions-mn/site-gen@v2
  with:
    agree-to-terms: true
- uses: actions-mn/release@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
```

### 3.3 Compile + release + pages

```yaml
- uses: actions-mn/cache@v1
- uses: actions-mn/site-gen@v2
  with:
    agree-to-terms: true
- uses: actions-mn/release@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
- uses: actions/upload-pages-artifact@v3
  with:
    path: _site/
```

### 3.4 Forced release on tag

```yaml
on:
  push:
    tags: ['release/**']

steps:
  - uses: actions/checkout@v4
  - uses: actions-mn/cache@v1
  - uses: actions-mn/site-gen@v2
    with:
      agree-to-terms: true
  - uses: actions-mn/release@v1
    with:
      force: true
      token: ${{ secrets.GITHUB_TOKEN }}
```

---

## 4. What gets removed from the current implementation

When refactoring to remove compilation:

| Remove | Reason |
|---|---|
| `src/compilation/metanorma-compiler.ts` | Compilation is `site-gen`'s job |
| `src/shared/version-helper.ts` | Copied from `site-gen`, only used by compiler |
| `src/shared/fs-helper.ts` | Copied from `site-gen`, only used by compiler |
| `ICompiler` interface in `domain/types.ts` | No longer needed |
| `CompilationConfig` interface | No longer needed |
| Action inputs: `agree-to-terms`, `install-fonts`, `continue-without-fonts`, `use-bundler`, `config-file` | Belong to `site-gen` |
| `metanorma-version` output | `site-gen` provides this |
| Pipeline compile step | Replaced by `site-gen` step in workflow |
| `npm` deps: `@actions/exec` | Only used by compiler |

| Keep | Reason |
|---|---|
| All domain types (`DocumentId`, `ReleaseTag`, etc.) | Core release logic |
| RXL extractor + `discoverDocuments` | Discovers compiled output |
| Visibility + pattern filters | Release-specific filtering |
| Content hash + change detector | Release-specific change detection |
| Zip packager + naming strategies | Release-specific packaging |
| GitHub Release publisher | Release-specific publishing |
| Manifest loader | Reads `metanorma.release.yml` |
| All 178 tests (minus compiler tests) | Valid for release pipeline |
