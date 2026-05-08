# 03: Domain Types & Interfaces

> **Status: COMPLETED** — Implemented and tested.

## Goal

Define all value objects, interfaces, and type contracts. These form the domain model that all other modules implement against. Pure types — no runtime logic beyond constructors and static factories.

## Source: `src/domain/types.ts`

### `DocumentId` — Value Object

Normalized kebab-case identifier derived from RXL `<docidentifier>`.

```typescript
export class DocumentId {
  private constructor(private readonly value: string) {}

  static fromRaw(rawIdentifier: string): DocumentId {
    // Normalize: lowercase, replace non-alphanumeric with hyphen, trim edges
    const normalized = rawIdentifier
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!normalized) throw new Error(`Cannot normalize identifier: "${rawIdentifier}"`);
    return new DocumentId(normalized);
  }

  toString(): string { return this.value; }

  // For tag namespace (before the '/')
  get tagPrefix(): string { return this.value; }

  // For zip filename
  get fileName(): string { return this.value; }

  equals(other: DocumentId): boolean { return this.value === other.value; }
}
```

**Test cases for `fromRaw`:**
| Input | Output |
|---|---|
| `"CC 51015"` | `"cc-51015"` |
| `"ISO/WD 8601-1:2026"` | `"iso-wd-8601-1-2026"` |
| `"ISO 8601-1:2019"` | `"iso-8601-1-2019"` |
| `"draft-ietf-calext-jscalendar-32"` | `"draft-ietf-calext-jscalendar-32"` |
| `"RFC 8984"` | `"rfc-8984"` |
| `"ITU-T E.999"` | `"itu-t-e-999"` |
| `""` | throws |

### `DocumentStage` — Value Object

Normalized stage with mapping for both CC (`:status:`) and ISO (`:docstage:/:docsubstage:`) conventions.

```typescript
export type StageName =
  | 'published'      // CC: published, ISO: 60.60
  | 'in-force'       // ITU/ISO: in-force
  | 'working-draft'  // CC: working-draft, ISO: 20.xx
  | 'committee-draft' // CC: committee-draft, ISO: 30.xx
  | 'draft-standard' // CC: draft-standard, ISO: 40.xx (DIS)
  | 'final-draft'    // CC: final-draft, ISO: 50.xx (FDIS)
  | 'proposal'       // CC: proposal
  | 'informational'  // IETF informational
  | 'standard'       // IETF/I-D stage marker
  | 'withdrawn'
  | 'cancelled';

export class DocumentStage {
  private constructor(
    private readonly name: StageName,
    private readonly substage?: string
  ) {}

  static fromStatus(status: string): DocumentStage { /* ... */ }
  static fromIsoStage(docstage: number, docsubstage: number): DocumentStage { /* ... */ }

  get isPublished(): boolean {
    return this.name === 'published' || this.name === 'in-force';
  }

  get isDraft(): boolean {
    return !this.isPublished &&
           this.name !== 'withdrawn' &&
           this.name !== 'cancelled';
  }

  // For tag suffix: empty if published, else abbreviated
  get tagSuffix(): string {
    if (this.isPublished) return '';
    const abbrevs: Record<string, string> = {
      'working-draft': 'wd',
      'committee-draft': 'cd',
      'draft-standard': 'ds',
      'final-draft': 'fd',
      'proposal': 'proposal',
      'informational': 'info',
      'standard': '',
      'withdrawn': 'withdrawn',
      'cancelled': 'cancelled',
    };
    return abbrevs[this.name] ?? this.name;
  }

  toString(): string { return this.name; }
}
```

**ISO stage mapping:**
| docstage | docsubstage | StageName |
|---|---|---|
| 20 | any | `working-draft` |
| 30 | any | `committee-draft` |
| 40 | any | `draft-standard` |
| 50 | any | `final-draft` |
| 60 | 60 | `published` |
| 95 | any | `withdrawn` |

### `DocumentVersion` — Value Object

Edition + stage combined.

```typescript
export class DocumentVersion {
  private constructor(
    private readonly edition: string,
    private readonly stage: DocumentStage
  ) {}

  static from(edition: string | undefined, stage: DocumentStage): DocumentVersion {
    const ed = edition?.trim() || '0';
    return new DocumentVersion(ed, stage);
  }

  // For tag: "ed1.0" or "ed1.0-wd"
  get tagComponent(): string {
    const base = `ed${this.edition}`;
    const suffix = this.stage.tagSuffix;
    return suffix ? `${base}-${suffix}` : base;
  }

  // For zip: "cc-51015-ed1.0.zip" or "cc-51015-ed1.0-wd.zip"
  toFileName(docId: DocumentId): string {
    const suffix = this.stage.tagSuffix;
    return suffix
      ? `${docId.fileName}-ed${this.edition}-${suffix}.zip`
      : `${docId.fileName}-ed${this.edition}.zip`;
  }

  get editionNumber(): string { return this.edition; }
  get isPreRelease(): boolean { return this.stage.isDraft; }
}
```

### `ReleaseTag` — Value Object

Computed GitHub release tag: `{docId}/{version}`

```typescript
export class ReleaseTag {
  private constructor(
    private readonly value: string,
    private readonly preRelease: boolean
  ) {}

  static from(docId: DocumentId, version: DocumentVersion): ReleaseTag {
    return new ReleaseTag(
      `${docId.tagPrefix}/${version.tagComponent}`,
      version.isPreRelease
    );
  }

  static parse(tag: string): ReleaseTag { /* inverse of from() */ }

  toString(): string { return this.value; }
  get isPreRelease(): boolean { return this.preRelease; }
}
```

### `ContentHash` — Value Object

SHA-256 fingerprint of a document's compiled output directory.

```typescript
export class ContentHash {
  private constructor(private readonly value: string) {}

  static async fromDirectory(dirPath: string): Promise<ContentHash>;
  static fromString(hash: string): ContentHash;

  toString(): string { return this.value; }
  equals(other: ContentHash): boolean { return this.value === other.value; }
}
```

### `Visibility` — Enum

```typescript
export enum Visibility {
  Public = 'public',
  Private = 'private',
  Members = 'members',
}
```

## Source: `src/domain/document-metadata.ts`

### `DocumentMetadata` — Aggregate of extracted RXL data

```typescript
export interface DocumentMetadata {
  readonly id: DocumentId;
  readonly title: string;
  readonly version: DocumentVersion;
  readonly doctype: string;
  readonly revdate: string | undefined;
  readonly sourcePath: string;
  readonly outputDir: string;      // directory containing compiled files
  readonly formats: string[];      // ['html', 'pdf', 'xml', 'rxl', 'doc']
}
```

## Source: `src/domain/release-manifest.ts`

### `ReleaseManifestEntry` / `ReleaseManifest`

```typescript
export interface ReleaseManifestEntry {
  readonly source: string;
  readonly visibility: Visibility;
}

export class ReleaseManifest {
  private constructor(private readonly entries: Map<string, ReleaseManifestEntry>) {}

  static parse(yamlContent: string): ReleaseManifest;
  static allPublic(): ReleaseManifest;  // fallback when file absent

  getVisibility(sourcePath: string): Visibility;
  listPublic(): string[];
  listAll(): ReleaseManifestEntry[];
}
```

## Interfaces (contracts for implementations)

### `IDocumentExtractor`

```typescript
export interface IDocumentExtractor {
  extract(rxlPath: string): Promise<DocumentMetadata>;
}
```

### `IChangeDetector`

```typescript
export interface ChangeDetectorResult {
  readonly changed: boolean;
  readonly currentHash: ContentHash;
  readonly previousHash?: ContentHash;
}

export interface IChangeDetector {
  detect(
    metadata: DocumentMetadata,
    tag: ReleaseTag,
    force: boolean
  ): Promise<ChangeDetectorResult>;
}
```

### `IArtifactPackager`

```typescript
export interface ArtifactResult {
  readonly zipPath: string;
  readonly zipSize: number;
}

export interface IArtifactPackager {
  package(metadata: DocumentMetadata, version: DocumentVersion): Promise<ArtifactResult>;
}
```

### `IReleasePublisher`

```typescript
export interface PublishResult {
  readonly tag: ReleaseTag;
  readonly url: string;
  readonly created: boolean;  // true = new release, false = updated existing
}

export interface IReleasePublisher {
  publish(
    tag: ReleaseTag,
    assetPath: string,
    hash: ContentHash,
    metadata: DocumentMetadata,
    preRelease: boolean
  ): Promise<PublishResult>;
}
```

## Checklist

- [ ] `src/domain/types.ts` — all value objects with static factories
- [ ] `src/domain/document-metadata.ts` — DocumentMetadata interface
- [ ] `src/domain/release-manifest.ts` — ReleaseManifest class
- [ ] All value objects are immutable (readonly properties, no setters)
- [ ] All factory methods validate inputs and throw on invalid data
- [ ] Unit tests for each value object (especially `DocumentId.fromRaw` normalization and `DocumentStage.fromIsoStage` mapping)
