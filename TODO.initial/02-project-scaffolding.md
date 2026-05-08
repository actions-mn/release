# 02: Project Scaffolding

> **Status: COMPLETED** — Implemented and tested.

## Goal

Set up the project following `actions-mn/site-gen` conventions exactly. Same tech stack, same build tooling, same quality gates.

## Files to Create

### `package.json`

Mirror `site-gen/package.json` structure:

```json
{
  "name": "metanorma-release",
  "version": "1.0.0",
  "description": "Compile and release Metanorma documents as per-document GitHub Releases",
  "main": "dist/index.js",
  "engines": { "node": ">=24.0.0" },
  "scripts": {
    "build": "tsc --noEmit && esbuild src/main.ts --bundle --platform=node --target=node24 --format=cjs --outfile=dist/index.js --minify --sourcemap",
    "format": "prettier --write '**/*.ts'",
    "format-check": "prettier --check '**/*.ts'",
    "lint": "eslint src",
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  },
  "dependencies": {
    "@actions/core": "^3.0.0",
    "@actions/exec": "^3.0.0",
    "@actions/io": "^3.0.2",
    "@actions/github": "^6.0.0",
    "archiver": "^7.0.0",
    "glob": "^11.0.0",
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    // Same as site-gen: typescript, esbuild, vitest, eslint, prettier
    // Plus: @types/archiver, @types/js-yaml
  }
}
```

Key dependencies added vs site-gen:
- `@actions/github` — for GitHub Release API (octokit)
- `archiver` — zip packaging
- `glob` — file discovery in compiled output
- `js-yaml` — parsing `metanorma.release.yml`

### `tsconfig.json`

Identical to site-gen. Copy directly.

### `vitest.config.ts`

Identical to site-gen with same coverage thresholds (80%).

### `eslint.config.js`

Identical to site-gen. Copy directly.

### `.prettierrc.json` / `.prettierignore`

Copy from site-gen.

### `action.yml`

```yaml
name: 'metanorma-release'
description: 'Compile and release Metanorma documents as per-document GitHub Releases'
author: 'actions-mn'
branding:
  icon: 'package'
  color: 'blue'

inputs:
  source-path:
    description: 'Source path containing the metanorma configuration'
    required: false
    default: '.'
  config-file:
    description: 'Metanorma configuration file name'
    required: false
    default: 'metanorma.yml'
  release-config:
    description: 'Release manifest file (visibility filter)'
    required: false
    default: 'metanorma.release.yml'
  output-dir:
    description: 'Output directory for compiled documents'
    required: false
    default: '_site'
  agree-to-terms:
    description: 'Agree to all third-party licensing terms'
    required: false
    default: 'true'
  install-fonts:
    description: 'Install missing fonts automatically'
    required: false
    default: 'true'
  continue-without-fonts:
    description: 'Continue processing even when fonts are missing'
    required: false
    default: 'true'
  use-bundler:
    description: 'Use bundler to execute metanorma'
    required: false
    default: 'false'
  force:
    description: 'Force release even if content hash matches last release'
    required: false
    default: 'false'
  include-pattern:
    description: 'Glob pattern to filter documents for release (e.g. "cc-*")'
    required: false
    default: '*'
  token:
    description: 'GitHub token for creating releases'
    required: false
    default: '${{ github.token }}'

outputs:
  released-documents:
    description: 'JSON array of released document identifiers'
  skipped-documents:
    description: 'JSON array of skipped document identifiers (unchanged)'
  total-documents:
    description: 'Total number of documents processed'
  metanorma-version:
    description: 'Version of metanorma used for compilation'

runs:
  using: 'node24'
  main: 'dist/index.js'
```

### `.github/workflows/ci.yml`

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - run: npm ci
      - run: npm run format-check
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

### `.github/workflows/release.yml`

```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: action-dist
          path: dist/
```

### Directory structure

```
release/
├── .github/workflows/
│   ├── ci.yml
│   └── release.yml
├── __test__/
├── dist/
├── src/
│   ├── main.ts
│   ├── input-helper.ts
│   ├── domain/
│   │   ├── types.ts              (value objects: DocumentId, ReleaseTag, etc.)
│   │   ├── document-metadata.ts  (extracted from RXL)
│   │   └── release-manifest.ts   (metanorma.release.yml model)
│   ├── extractors/
│   │   ├── document-extractor.ts (interface)
│   │   ├── rxl-extractor.ts      (default: parse any RXL)
│   │   └── doc-id-normalizer.ts  (CC, ISO, IETF normalization)
│   ├── filters/
│   │   ├── visibility-filter.ts  (interface + default)
│   │   └── pattern-filter.ts     (include-pattern glob matching)
│   ├── detection/
│   │   ├── change-detector.ts    (interface)
│   │   └── content-hash.ts       (SHA-256 of compiled output)
│   ├── packaging/
│   │   ├── artifact-packager.ts  (interface)
│   │   └── zip-packager.ts       (default: zip per document)
│   ├── publishing/
│   │   ├── release-publisher.ts  (interface)
│   │   └── github-release.ts     (default: GitHub Releases API)
│   ├── compilation/
│   │   └── metanorma-compiler.ts (delegates to site-gen logic)
│   └── shared/
│       ├── fs-helper.ts          (copy from site-gen)
│       ├── version-helper.ts     (copy from site-gen)
│       └── logger.ts             (structured logging)
├── action.yml
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
├── .prettierrc.json
├── .prettierignore
└── README.md
```

## Checklist

- [ ] `npm init` with dependencies
- [ ] Copy `tsconfig.json`, `vitest.config.ts`, `eslint.config.js` from site-gen
- [ ] Create `action.yml`
- [ ] Create `.github/workflows/ci.yml`
- [ ] Create directory structure under `src/`
- [ ] Create empty `src/main.ts` with hello-world
- [ ] `npm run build` passes
- [ ] `npm test` passes (empty test suite)
