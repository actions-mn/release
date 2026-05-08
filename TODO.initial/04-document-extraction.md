# 04: Document Extraction

> **Status: COMPLETED** — Implemented and tested.

## Goal

Scan the compiled output directory for RXL files and extract `DocumentMetadata` from each one. This is the discovery step — finding what documents were built.

## Interface

```typescript
// src/extractors/document-extractor.ts
export interface IDocumentExtractor {
  extract(rxlPath: string): Promise<DocumentMetadata>;
}
```

## Implementation: `RxlExtractor`

The default (and initially only) extractor. Parses any RXL file regardless of document class (CC, ISO, IETF — the RXL format is universal).

### RXL Structure (reference)

```xml
<bibdata type="standard">
  <docidentifier type="ISO" primary="true">ISO/WD 8601-1:2026</docidentifier>
  <docidentifier type="ISO">CC 51015</docidentifier>
  <docnumber>51015</docnumber>
  <title language="en" type="main">...</title>
  <edition>1</edition>
  <status>
    <stage value="published">published</stage>
  </status>
  <!-- OR for ISO: -->
  <status>
    <stage value="20" abbreviation="WD">working-draft</stage>
    <substage value="20"/>
  </status>
  <doctype>standard</doctype>
  <date type="published">2019-01-18</date>
  ...
</bibdata>
```

### Extraction Logic

```typescript
// src/extractors/rxl-extractor.ts
export class RxlExtractor implements IDocumentExtractor {
  async extract(rxlPath: string): Promise<DocumentMetadata> {
    const xml = await fs.readFile(rxlPath, 'utf-8');
    const doc = parseXml(xml);

    // 1. Primary docidentifier → DocumentId
    const rawId = doc.xpath("//*[local-name()='docidentifier'][@primary='true']").text;
    const id = DocumentId.fromRaw(rawId);

    // 2. Edition
    const edition = doc.xpath("//*[local-name()='edition']")?.text;

    // 3. Stage — try :status:/:stage: text first (CC), then numeric (ISO)
    const stage = this.extractStage(doc);

    // 4. Title
    const title = doc.xpath("//*[local-name()='title'][@type='main']")?.text ?? '';

    // 5. Doctype
    const doctype = doc.xpath("//*[local-name()='doctype']")?.text ?? '';

    // 6. Revdate
    const revdate = doc.xpath("//*[local-name()='date'][@type='published']/*[local-name()='on']")?.text;

    // 7. Output dir = parent of rxlPath
    const outputDir = path.dirname(rxlPath);

    // 8. Formats = detect which files exist in outputDir
    const formats = await detectFormats(outputDir);

    // 9. Source path — attempt to resolve from output dir back to source
    const sourcePath = resolveSourcePath(outputDir);

    return { id, title, version: DocumentVersion.from(edition, stage), doctype, revdate, sourcePath, outputDir, formats };
  }

  private extractStage(doc: XmlDocument): DocumentStage {
    // Try text-based stage (CC, CalConnect)
    const stageText = doc.xpath("//*[local-name()='status']/*[local-name()='stage']").text;
    if (stageText && !/^\d+$/.test(stageText)) {
      return DocumentStage.fromStatus(stageText);
    }

    // Try numeric stage (ISO)
    const stageNum = parseInt(doc.xpath("//*[local-name()='status']/*[local-name()='stage']").attr('value'), 10);
    const substageNum = parseInt(doc.xpath("//*[local-name()='status']/*[local-name()='substage']").attr('value'), 10);
    if (!isNaN(stageNum)) {
      return DocumentStage.fromIsoStage(stageNum, substageNum);
    }

    // Fallback
    return DocumentStage.fromStatus(stageText || 'published');
  }
}
```

### Source Path Resolution

The compiled output is in `_site/documents/{source-relative-path}/`. We need to map back to the source file to match against `metanorma.release.yml` entries.

```typescript
function resolveSourcePath(outputDir: string): string {
  // _site/documents/sources/cc-51015/document.html → sources/cc-51015/document.adoc
  // Strip _site/documents/ prefix, replace extension with .adoc
  // This mapping depends on metanorma's output structure
}
```

This is fragile — metanorma's output structure may vary. Alternative: include source path in a custom RXL field, or resolve it at a higher level by cross-referencing `metanorma.yml` source files against output directories.

### Document Discovery (top-level function)

```typescript
// src/extractors/document-discovery.ts
export async function discoverDocuments(
  outputDir: string,
  extractor: IDocumentExtractor
): Promise<DocumentMetadata[]> {
  const rxlFiles = await glob(`${outputDir}/**/*.rxl`);
  const results: DocumentMetadata[] = [];

  for (const rxl of rxlFiles) {
    try {
      const metadata = await extractor.extract(rxl);
      results.push(metadata);
    } catch (error) {
      // Log but don't fail — one bad RXL shouldn't stop the whole pipeline
      logger.warn(`Failed to extract metadata from ${rxl}: ${error}`);
    }
  }

  return results;
}
```

## Spec: Doc-Id Normalization Rules

The `DocumentId.fromRaw()` normalization must handle these patterns:

| Raw docidentifier | Organization | Normalized |
|---|---|---|
| `CC 51015` | CalConnect | `cc-51015` |
| `CC/WD 51015` | CalConnect draft | `cc-wd-51015` |
| `ISO/WD 8601-1:2026` | ISO draft | `iso-wd-8601-1-2026` |
| `ISO 8601-1:2019` | ISO published | `iso-8601-1-2019` |
| `ISO/CD 8601-2:2026` | ISO CD | `iso-cd-8601-2-2026` |
| `ISO/DIS 8601-1` | ISO DIS | `iso-dis-8601-1` |
| `draft-ietf-calext-jscalendar-32` | IETF I-D | `draft-ietf-calext-jscalendar-32` |
| `RFC 8984` | IETF RFC | `rfc-8984` |
| `ITU-T E.999` | ITU-T | `itu-t-e-999` |

The normalization is purely mechanical: lowercase → replace non-alphanumeric with hyphen → trim. No organization-specific logic needed — the raw docidentifier already encodes everything.

## Tests

- `RxlExtractor` with fixture RXL files for CC, ISO, IETF
- `DocumentId.fromRaw` table-driven tests covering all patterns above
- `DocumentStage.fromStatus` for all CC stage names
- `DocumentStage.fromIsoStage` for numeric stages 20–95
- `discoverDocuments` with a mock `_site/` directory structure
- Error handling: malformed XML, missing docidentifier, empty RXL
