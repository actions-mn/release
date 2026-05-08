# 07: Artifact Packaging & Tag Naming

> **Status: COMPLETED** — Implemented and tested.

## Goal

Package each document's compiled output into a self-contained zip file with a canonical name, and compute the release tag from document metadata.

## Tag Computation

Tag format: `{docId-tagPrefix}/{version-tagComponent}`

```typescript
// src/packaging/tag-builder.ts
export class TagBuilder {
  static build(metadata: DocumentMetadata): ReleaseTag {
    return ReleaseTag.from(metadata.id, metadata.version);
  }
}
```

### Examples (from architecture spec)

| Document | Edition | Stage | Tag | Asset |
|---|---|---|---|---|
| CC 51015 | 1 | published | `cc-51015/ed1` | `cc-51015-ed1.zip` |
| CC 51015 | 2 | working-draft | `cc-51015/ed2-wd` | `cc-51015-ed2-wd.zip` |
| ISO/WD 8601-1:2026 | 2 | WD (20.20) | `iso-wd-8601-1-2026/ed2-wd` | `iso-wd-8601-1-2026-ed2-wd.zip` |
| ISO 8601-1:2019 | 1 | published (60.60) | `iso-8601-1-2019/ed1` | `iso-8601-1-2019-ed1.zip` |
| draft-ietf-calext-jscalendar-32 | — | standard | `id-calext-jscalendar/32` | `draft-ietf-calext-jscalendar-32.zip` |
| RFC 8984 | — | published | `rfc-8984/1` | `rfc-8984.zip` |

### Special Case: IETF Documents

IETF documents don't follow the `edition + stage` pattern:
- I-Ds have a draft name with version: `draft-ietf-calext-jscalendar-32`
- RFCs have a simple number: `RFC 8984`

For I-Ds:
- Tag: `id-calext-jscalendar/32` (extract org and name from draft identifier, version from suffix)
- Asset: use the full kebab-case name: `draft-ietf-calext-jscalendar-32.zip`

For RFCs:
- Tag: `rfc-8984/1`
- Asset: `rfc-8984.zip`

Detection: if the docidentifier starts with `draft-` or `RFC `, use IETF naming rules.

This should be handled by a strategy in the `TagBuilder`:

```typescript
interface INamingStrategy {
  computeTag(id: DocumentId, version: DocumentVersion): ReleaseTag;
  computeAssetName(id: DocumentId, version: DocumentVersion): string;
}

class StandardNamingStrategy implements INamingStrategy { /* CC, ISO */ }
class IetfDraftNamingStrategy implements INamingStrategy { /* I-D */ }
class IetfRfcNamingStrategy implements INamingStrategy { /* RFC */ }
```

Strategy selection based on docidentifier prefix in `DocumentId`:

```typescript
function getNamingStrategy(id: DocumentId): INamingStrategy {
  const raw = id.toString();
  if (raw.startsWith('draft-')) return new IetfDraftNamingStrategy();
  if (raw.startsWith('rfc-')) return new IetfRfcNamingStrategy();
  return new StandardNamingStrategy();
}
```

## Zip Packaging

```typescript
// src/packaging/zip-packager.ts
import Archiver from 'archiver';

export class ZipPackager implements IArtifactPackager {
  async package(metadata: DocumentMetadata, version: DocumentVersion): Promise<ArtifactResult> {
    const strategy = getNamingStrategy(metadata.id);
    const assetName = strategy.computeAssetName(metadata.id, version);
    const zipPath = path.join(os.tmpdir(), `mn-release-${assetName}`);

    await this.createZip(metadata.outputDir, zipPath);
    const stats = await fs.stat(zipPath);

    return { zipPath, zipSize: stats.size };
  }

  private createZip(sourceDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }
}
```

### Zip contents

The zip contains the compiled output directory contents (flat, no nested directory):

```
cc-51015-ed1.zip
├── cc-51015-ed1.html
├── cc-51015-ed1.pdf
├── cc-51015-ed1.xml
├── cc-51015-ed1.rxl
└── cc-51015-ed1.doc
```

Files inside the zip are renamed to match the canonical doc-id + version name. The original compiled filenames (like `document.html`, `document.pdf`) must be renamed during packaging.

```typescript
private async createZipWithCanonicalNames(
  sourceDir: string,
  outputPath: string,
  canonicalName: string
): Promise<void> {
  // For each file in sourceDir, rename to canonicalName.{ext}
  // document.html → cc-51015-ed1.html
  // document.pdf  → cc-51015-ed1.pdf
  // etc.
}
```

This is important because:
1. Downstream consumers get predictable filenames
2. Unzipping into a shared directory doesn't cause collisions
3. The filename communicates the document identity

## Tests

- `TagBuilder` for CC published, CC draft, ISO draft, ISO published
- `StandardNamingStrategy` tag and asset computation
- `IetfDraftNamingStrategy` tag and asset computation
- `IetfRfcNamingStrategy` tag and asset computation
- `ZipPackager` creates valid zip
- `ZipPackager` renames files to canonical names inside zip
- `ZipPackager` handles empty output directory
- `ZipPackager` handles large files
- Integration: packaging a fixture `_site/` directory
