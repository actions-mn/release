# 12: Integration — standards.calconnect.org Aggregation

> **Status: REMAINING** — This is downstream integration work, not part of the release action itself. See checklist below.

## Goal

After `actions-mn/release` is complete, rewrite the `standards.calconnect.org` CI to consume per-document releases instead of compiling submodules directly. This is the downstream consumer of the release action.

## Current Architecture (to be replaced)

```
standards.calconnect.org CI:
  1. Checkout submodules (53 repos)
  2. metanorma site generate per doc_type (11 matrix jobs)
  3. Merge artifacts
  4. make build-relaton (concatenate + xml2html)
  5. Jekyll build
  6. Deploy
```

Problems: submodule checkout is expensive, monolithic compilation is slow, 30 of 53 repos were missing from metanorma YAMLs.

## New Architecture

```
standards.calconnect.org CI:
  1. Discover repos via GitHub Topics API (topic:metanorma-release + org:CalConnect)
  2. Download latest releases from each repo (per-document zips)
  3. Extract all zips into a shared directory
  4. relaton concatenate → relaton xml2html (using existing Liquid templates)
  5. Jekyll build
  6. Deploy
```

No submodules. No metanorma compilation. The index site is a pure aggregator.

## Workflow Sketch

```yaml
# .github/workflows/build_deploy.yml
name: Build and Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:
  schedule:
    - cron: '0 6 * * *'  # daily rebuild to pick up new releases

jobs:
  collect:
    runs-on: ubuntu-latest
    outputs:
      repos: ${{ steps.discover.outputs.repos }}
    steps:
      - uses: actions/checkout@v4
      - id: discover
        run: |
          # Discover all repos with metanorma-release topic
          REPOS=$(curl -s "https://api.github.com/search/repositories\
            ?q=topic:metanorma-release+org:CalConnect&per_page=100" \
            | jq -c '[.items[] | {owner: .owner.login, repo: .name}]')
          echo "repos=$REPOS" >> $GITHUB_OUTPUT

  download:
    needs: collect
    runs-on: ubuntu-latest
    strategy:
      matrix:
        repo: ${{ fromJson(needs.collect.outputs.repos) }}
    steps:
      - name: Download latest releases
        uses: actions/github-script@v7
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            const { owner, repo } = ${{ matrix.repo }};
            const releases = await github.rest.repos.listReleases({ owner, repo, per_page: 100 });

            for (const release of releases.data) {
              // Skip pre-releases for stable index, or include for draft view
              // Group by document: take latest release per document
              for (const asset of release.assets) {
                if (asset.name.endsWith('.zip')) {
                  const fs = require('fs');
                  const path = require('path');
                  const dir = path.join('artifacts', release.tag_name);
                  fs.mkdirSync(dir, { recursive: true });

                  const response = await fetch(asset.browser_download_url);
                  const buffer = Buffer.from(await response.arrayBuffer());
                  fs.writeFileSync(path.join(dir, asset.name), buffer);
                }
              }
            }

      - uses: actions/upload-artifact@v4
        with:
          name: docs-${{ matrix.repo.repo }}
          path: artifacts/

  build-index:
    needs: download
    runs-on: ubuntu-latest
    container: metanorma/metanorma:latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          pattern: docs-*
          path: all-released-docs/
          merge-multiple: true

      - name: Extract and build Relaton index
        run: |
          mkdir -p all-rxl
          # Extract all zips
          for zip in all-released-docs/**/*.zip; do
            unzip -o "$zip" -d all-extracted/
          done

          # Collect all RXL files
          find all-extracted/ -name "*.rxl" -exec cp {} all-rxl/ \;

          # Build Relaton index (same as current make build-relaton)
          relaton concatenate all-rxl/ relaton/collection.xml
          relaton xml2html relaton/collection.xml \
            --template-dir src-documents/_relaton_templates/

      - name: Jekyll build
        run: |
          bundle install
          bundle exec jekyll build

      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site/

  deploy:
    needs: build-index
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
```

## Key Changes vs. Current

| Aspect | Current | New |
|---|---|---|
| Document source | Git submodules | GitHub Releases |
| Compilation | In CI (metanorma site generate) | In document repo CI |
| Relaton index | Built from compiled RXL | Built from released RXL |
| Discovery | Hardcoded metanorma YAMLs | GitHub Topics API |
| Missing documents | Manual YAML maintenance | Automatic (topic + release) |
| Build time | ~30 min (compile all) | ~5 min (download + index) |

## What Gets Removed

- `src-documents/` submodules (replaced by release artifacts)
- `metanorma-*.yml` files (no longer compiling here)
- `scripts/repopulate-metanorma-yaml` (no longer needed)
- `scripts/canonicalize-document-paths` (canonicalization happens in release action)
- `make build`, `make build-parallel`, `make build-relaton` targets
- `build-docs` job in CI workflow

## What Stays

- `_config.yml` — Jekyll configuration
- `_layouts/`, `_includes/`, `_pages/` — site templates
- `src-documents/_relaton_templates/` — Liquid templates for document rendering
- `_frontend/` — Tailwind CSS / Vite
- `Makefile` — simplified (jekyll, serve targets only)

## Migration Steps

1. Add `metanorma-release` topic to all CalConnect document repos
2. Add `actions-mn/release` workflow to each document repo
3. Run initial release on each repo to seed GitHub Releases
4. Create `metanorma.release.yml` in repos that need visibility control
5. Rewrite `standards.calconnect.org` CI to aggregation model
6. Remove submodules (or keep as fallback during transition)
7. Test end-to-end: repo push → release → aggregation → deploy

## Checklist

- [ ] Create new CI workflow for aggregation
- [ ] Implement repo discovery via GitHub Topics
- [ ] Implement release download and extraction
- [ ] Adapt `make build-relaton` to work with extracted RXL files
- [ ] Test with a few repos before full migration
- [ ] Remove submodules after validation
