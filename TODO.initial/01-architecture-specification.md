# 01: Architecture & Specification

> **Status: COMPLETED** — All design decisions implemented. Architecture audit performed.

## Purpose

`actions-mn/release` is a GitHub Action that compiles Metanorma documents and publishes them as per-document GitHub Releases. It replaces the monolithic `metanorma site generate → single artifact` pattern with granular, per-document releases that downstream portals (like standards.calconnect.org) can aggregate.

## References

- `actions-mn/site-gen` — compilation step (reuse its `MetanormaCommandManager` pattern)
- `actions-mn/build-and-publish` — meta-action pattern (compose site-gen + release)

## Domain Model

```
┌─────────────────────────────────────────────────────────────┐
│                     Release Pipeline                         │
│                                                              │
│  metanorma.yml ──┐                                           │
│                   ├──► Compile ──► Discover ──► Filter ──►  │
│  metanorma      ──┘    (site-gen)   (RXL      (release      │
│  .release.yml                         scan)    manifest)     │
│                                                              │
│  ──► Detect ──► Package ──► Tag ──► Publish                 │
│      (content     (zip)    (tag     (GitHub                  │
│       hash)                naming)  Releases)                │
└─────────────────────────────────────────────────────────────┘
```

### Core Value Objects

| Type | Responsibility | Example |
|---|---|---|
| `DocumentId` | Normalized kebab-case identifier | `cc-51015`, `iso-wd-8601-1-2026`, `draft-ietf-calext-jscalendar-32` |
| `DocumentVersion` | Edition + stage | `ed1.0`, `ed2.0-wd` |
| `ReleaseTag` | Computed tag for GitHub Release | `cc-51015/ed1.0`, `iso-8601-1-2026/ed2.0-wd` |
| `ReleaseAsset` | Packaged zip with canonical name | `cc-51015-ed1.0.zip` |
| `ContentHash` | Fingerprint of compiled output | `sha256:abc123...` |
| `Visibility` | Release clearance | `public`, `private`, `members` |

### Interfaces (Open/Closed)

```
IDocumentExtractor        — extract DocumentId from RXL (CC, ISO, IETF strategies)
IVisibilityFilter         — filter documents by release manifest
IChangeDetector           — detect if content changed since last release
IArtifactPackager         — package compiled output into release artifact
IReleasePublisher         — create/update GitHub Releases
```

Each interface has a default implementation. Users can extend by adding new strategies without modifying existing code.

## Design Decisions

### 1. Compile via `metanorma site generate`, not `metanorma compile`

Reason: `site generate` handles the full manifest (collections, Relaton, cross-references). `compile` works on a single file and may miss collection-level concerns. We always compile the full `metanorma.yml` and filter at the release stage.

### 2. Release manifest is a separate file (`metanorma.release.yml`)

Reason: `metanorma.yml` is owned by metanorma — we cannot extend its schema. A separate file under our control avoids coupling. The naming follows `metanorma.*.yml` convention.

### 3. Per-document tags (not per-repo)

Reason: In a multi-document repo, documents evolve independently. Per-document tags enable selective release (only release what changed) and independent lifecycle management.

### 4. Content-hash change detection (not git diff)

Reason: Git diff on `.adoc` sources misses changes in included sections, images, and dependencies. Hashing the compiled output is the definitive change signal.

### 5. Immutability for published releases, rolling for drafts

Reason: A `published`/`in-force` release tag (e.g. `cc-51015/ed1.0`) is created once and never overwritten. Draft tags (e.g. `cc-51015/ed2.0-wd`) can be updated in-place as the draft evolves — equivalent to a pre-release channel.

## Tag Naming Specification

| Document Type | Stage | Tag | Asset |
|---|---|---|---|
| CC standard | published | `cc-51015/ed1.0` | `cc-51015-ed1.0.zip` |
| CC standard | working-draft | `cc-51015/ed2.0-wd` | `cc-51015-ed2.0-wd.zip` |
| CC standard | committee-draft | `cc-51015/ed2.0-cd` | `cc-51015-ed2.0-cd.zip` |
| ISO | published (60.60) | `iso-8601-1-2019/ed1.0` | `iso-8601-1-2019-ed1.0.zip` |
| ISO | WD (20.20) | `iso-wd-8601-1-2026/ed2.0-wd` | `iso-wd-8601-1-2026-ed2.0-wd.zip` |
| IETF I-D | any | `id-calext-jscalendar/32` | `draft-ietf-calext-jscalendar-32.zip` |
| IETF RFC | published | `rfc-8984/1` | `rfc-8984.zip` |

Stage suffixes for CC: `-wd`, `-cd`, `-ds`, `-fd`, `-proposal`. No suffix for `published`/`in-force`.

ISO stage is embedded in the docidentifier itself (`ISO/WD 8601-1:2026`), so the normalized ID already contains it.

IETF I-D has no separate stage — it's always a draft. The version number is the revision counter.

## Release Manifest Format (`metanorma.release.yml`)

```yaml
# Lists documents in the repo with their release visibility.
# Omitted documents default to visibility: private (not released).
# This file is opt-in — if absent, all documents are released (backward compat).

documents:
  - source: sources/cc-51015.adoc
    # visibility: public  (default — can omit)

  - source: sources/cc-51024.adoc

  - source: sources/cc-51026.adoc
    visibility: private       # explicitly withheld from release

  - source: sources/draft-ietf-calext-jscalendar-32.adoc
```

## GitHub Topic for Discovery

Topic: `metanorma-release`

Portals discover participating repos via:
```
GET /search/repositories?q=topic:metanorma-release+org:{org}
```

## Error Handling Strategy

- Compile failures → fail the action, report which documents failed
- Release manifest missing → treat as "all documents public" (backward compat)
- Individual document release failure → log error, continue with other documents, report summary
- Content hash comparison failure → force release (fail open, not fail silent)
