# 05: Release Manifest & Visibility Filtering

> **Status: COMPLETED** — Implemented and tested.

## Goal

Parse `metanorma.release.yml` and filter documents by visibility. If the file doesn't exist, treat all documents as public (backward compatibility).

## YAML Format

```yaml
# metanorma.release.yml — optional
# Lists documents with release visibility.
# Default visibility is "public". Mark internal docs as "private".

documents:
  - source: sources/cc-51015.adoc
    # visibility defaults to "public"

  - source: sources/cc-51024.adoc

  - source: sources/cc-51026.adoc
    visibility: private

  - source: sources/draft-ietf-calext-jscalendar-32.adoc
```

## Implementation: `ReleaseManifest`

```typescript
// src/domain/release-manifest.ts
export class ReleaseManifest {
  private constructor(
    private readonly entries: Map<string, ReleaseManifestEntry>,
    private readonly isAllPublic: boolean
  ) {}

  static parse(yamlContent: string): ReleaseManifest {
    const parsed = yaml.load(yamlContent) as ManifestYaml;
    const entries = new Map<string, ReleaseManifestEntry>();

    for (const doc of parsed.documents ?? []) {
      entries.set(doc.source, {
        source: doc.source,
        visibility: doc.visibility === 'private' ? Visibility.Private
                  : doc.visibility === 'members' ? Visibility.Members
                  : Visibility.Public,
      });
    }

    return new ReleaseManifest(entries, false);
  }

  static allPublic(): ReleaseManifest {
    return new ReleaseManifest(new Map(), true);
  }

  getVisibility(sourcePath: string): Visibility {
    if (this.isAllPublic) return Visibility.Public;
    return this.entries.get(sourcePath)?.visibility ?? Visibility.Private;
  }

  isPublic(sourcePath: string): boolean {
    return this.getVisibility(sourcePath) === Visibility.Public;
  }

  listPublic(): string[] {
    if (this.isAllPublic) return []; // empty = "all public"
    return [...this.entries.values()]
      .filter(e => e.visibility === Visibility.Public)
      .map(e => e.source);
  }
}
```

## File Resolution

The action needs to find `metanorma.release.yml` relative to `source-path`:

```typescript
// src/filters/manifest-loader.ts
export async function loadManifest(sourcePath: string, fileName: string): Promise<ReleaseManifest> {
  const filePath = path.join(sourcePath, fileName);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return ReleaseManifest.parse(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.info(`Release manifest not found at ${filePath}, treating all documents as public`);
      return ReleaseManifest.allPublic();
    }
    throw error;
  }
}
```

## Implementation: `VisibilityFilter`

```typescript
// src/filters/visibility-filter.ts
export interface IVisibilityFilter {
  filter(documents: DocumentMetadata[], manifest: ReleaseManifest): DocumentMetadata[];
}

export class VisibilityFilter implements IVisibilityFilter {
  filter(documents: DocumentMetadata[], manifest: ReleaseManifest): DocumentMetadata[] {
    return documents.filter(doc => manifest.isPublic(doc.sourcePath));
  }
}
```

## Implementation: `PatternFilter`

Applies after visibility filter. Filters by the `include-pattern` input (glob on doc-id).

```typescript
// src/filters/pattern-filter.ts
export class PatternFilter {
  constructor(private readonly pattern: string) {}

  filter(documents: DocumentMetadata[]): DocumentMetadata[] {
    if (this.pattern === '*') return documents;

    const matcher = new Minimatch(this.pattern);
    return documents.filter(doc => matcher.match(doc.id.toString()));
  }
}
```

## Filter Pipeline Order

```
All compiled documents
  → VisibilityFilter (remove private/unlisted)
    → PatternFilter (narrow by include-pattern)
      → Result: documents eligible for release
```

## Source Path Matching Challenge

The `metanorma.release.yml` lists source paths like `sources/cc-51015.adoc`. The compiled output is in `_site/documents/sources/cc-51015/`. The `DocumentMetadata.sourcePath` must match the manifest's source paths.

Resolution strategy:
1. During extraction, store the relative source path as it appears in `metanorma.yml`
2. The manifest uses the same source path format
3. Matching is by string equality on the relative path

If path resolution is ambiguous, log a warning and default to public (fail open for visibility — accidental publication is worse than accidental withholding).

## Tests

- `ReleaseManifest.parse` with valid YAML
- `ReleaseManifest.parse` with empty `documents:` array
- `ReleaseManifest.allPublic()` returns public for any path
- `ReleaseManifest` returns `private` for unlisted documents when file exists
- `ReleaseManifest` returns `public` for unlisted documents when file absent
- `VisibilityFilter` removes private documents
- `VisibilityFilter` keeps all documents when manifest is all-public
- `PatternFilter` with `*` keeps all
- `PatternFilter` with `cc-*` keeps only CC documents
- `PatternFilter` with `iso-*` keeps only ISO documents
- `loadManifest` returns allPublic when file missing
- `loadManifest` throws on malformed YAML
