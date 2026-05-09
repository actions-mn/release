import type { DocumentMetadata } from './document-metadata.js';

// ─── Enums ──────────────────────────────────────────────────────────────────

export enum Visibility {
  Public = 'public',
  Private = 'private',
  Members = 'members'
}

// ─── Value Objects ──────────────────────────────────────────────────────────

export class DocumentId {
  private constructor(private readonly value: string) {}

  static fromRaw(rawIdentifier: string): DocumentId {
    const normalized = rawIdentifier
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!normalized) {
      throw new Error(`Cannot normalize identifier: "${rawIdentifier}"`);
    }
    return new DocumentId(normalized);
  }

  toString(): string {
    return this.value;
  }

  get tagPrefix(): string {
    return this.value;
  }

  get fileName(): string {
    return this.value;
  }

  equals(other: DocumentId): boolean {
    return this.value === other.value;
  }
}

export class DocumentStage {
  private constructor(private readonly name: string) {}

  private static readonly PUBLISHED_STAGES = new Set([
    'published',
    'in-force',
    'approved',
    'standard'
  ]);

  private static readonly STAGE_ABBREVS: Record<string, string> = {
    'working-draft': 'wd',
    'committee-draft': 'cd',
    'draft-standard': 'ds',
    'final-draft': 'fd',
    proposal: 'proposal',
    informational: 'info',
    withdrawn: 'withdrawn',
    cancelled: 'cancelled'
  };

  static fromStatus(status: string): DocumentStage {
    const normalized = status.toLowerCase().trim().replace(/\s+/g, '-');
    if (!normalized) {
      throw new Error(`Empty stage name`);
    }
    return new DocumentStage(normalized);
  }

  static fromIsoStage(docstage: number, _docsubstage: number): DocumentStage {
    if (docstage === 20) return new DocumentStage('working-draft');
    if (docstage === 30) return new DocumentStage('committee-draft');
    if (docstage === 40) return new DocumentStage('draft-standard');
    if (docstage === 50) return new DocumentStage('final-draft');
    if (docstage === 60) return new DocumentStage('published');
    if (docstage === 95) return new DocumentStage('withdrawn');
    return new DocumentStage('working-draft');
  }

  get isPublished(): boolean {
    return DocumentStage.PUBLISHED_STAGES.has(this.name);
  }

  get isDraft(): boolean {
    return (
      !this.isPublished &&
      this.name !== 'withdrawn' &&
      this.name !== 'cancelled'
    );
  }

  get tagSuffix(): string {
    if (this.isPublished) return '';
    return DocumentStage.STAGE_ABBREVS[this.name] ?? this.name;
  }

  toString(): string {
    return this.name;
  }
}

export class DocumentVersion {
  private constructor(
    private readonly edition: string,
    private readonly stage: DocumentStage
  ) {}

  static from(
    edition: string | undefined,
    stage: DocumentStage
  ): DocumentVersion {
    const ed = edition?.trim() || '0';
    return new DocumentVersion(ed, stage);
  }

  get tagComponent(): string {
    const base = `ed${this.edition}`;
    const suffix = this.stage.tagSuffix;
    return suffix ? `${base}-${suffix}` : base;
  }

  toFileName(docId: DocumentId): string {
    const suffix = this.stage.tagSuffix;
    return suffix
      ? `${docId.fileName}-ed${this.edition}-${suffix}.zip`
      : `${docId.fileName}-ed${this.edition}.zip`;
  }

  get editionNumber(): string {
    return this.edition;
  }

  get isPreRelease(): boolean {
    return this.stage.isDraft;
  }
}

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

  static create(tag: string, preRelease: boolean): ReleaseTag {
    if (!tag.includes('/')) {
      throw new Error(`Invalid release tag format: "${tag}"`);
    }
    return new ReleaseTag(tag, preRelease);
  }

  static parse(tag: string): ReleaseTag {
    const slashIndex = tag.indexOf('/');
    if (slashIndex === -1) {
      throw new Error(`Invalid release tag format: "${tag}"`);
    }
    const versionPart = tag.slice(slashIndex + 1);
    const isPreRelease =
      versionPart.includes('-wd') ||
      versionPart.includes('-cd') ||
      versionPart.includes('-ds') ||
      versionPart.includes('-fd') ||
      versionPart.includes('-proposal');
    return new ReleaseTag(tag, isPreRelease);
  }

  toString(): string {
    return this.value;
  }

  get isPreRelease(): boolean {
    return this.preRelease;
  }

  equals(other: ReleaseTag): boolean {
    return this.value === other.value;
  }
}

export class ContentHash {
  private constructor(private readonly hex: string) {}

  static fromString(hex: string): ContentHash {
    return new ContentHash(hex);
  }

  toString(): string {
    return this.hex;
  }

  equals(other: ContentHash): boolean {
    return this.hex === other.hex;
  }
}

// ─── Result Types ───────────────────────────────────────────────────────────

export interface ChangeDetectorResult {
  readonly changed: boolean;
  readonly currentHash: ContentHash;
  readonly previousHash?: ContentHash;
}

export interface ArtifactResult {
  readonly zipPath: string;
  readonly zipSize: number;
}

export interface PublishResult {
  readonly tag: ReleaseTag;
  readonly url: string;
  readonly created: boolean;
}

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface IDocumentExtractor {
  extract(rxlPath: string): Promise<DocumentMetadata>;
  discover(outputDir: string): Promise<DocumentMetadata[]>;
}

export interface IDocumentFilter {
  filter(documents: readonly DocumentMetadata[]): DocumentMetadata[];
}

export interface IChangeDetector {
  detect(
    metadata: DocumentMetadata,
    tag: ReleaseTag,
    force: boolean
  ): Promise<ChangeDetectorResult>;
}

export interface IArtifactPackager {
  package(
    metadata: DocumentMetadata,
    version: DocumentVersion
  ): Promise<ArtifactResult>;
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

// ─── GitHub API Protocol ──────────────────────────────────────────────────

export interface GitHubReleaseData {
  id: number;
  tag_name: string;
  html_url: string;
  prerelease: boolean;
  body: string | null;
  assets: Array<{ id: number; name: string }>;
}

export interface GitHubReleasesApi {
  rest: {
    repos: {
      getReleaseByTag(params: {
        owner: string;
        repo: string;
        tag: string;
      }): Promise<{ data: GitHubReleaseData }>;
      createRelease(params: {
        owner: string;
        repo: string;
        tag_name: string;
        name?: string;
        body?: string;
        prerelease?: boolean;
        draft?: boolean;
      }): Promise<{ data: GitHubReleaseData }>;
      updateRelease(params: {
        owner: string;
        repo: string;
        release_id: number;
        body?: string;
        prerelease?: boolean;
      }): Promise<{ data: GitHubReleaseData }>;
      deleteReleaseAsset(params: {
        owner: string;
        repo: string;
        asset_id: number;
      }): Promise<void>;
      uploadReleaseAsset(params: {
        owner: string;
        repo: string;
        release_id: number;
        name: string;
        data: string | NodeJS.ReadableStream;
        headers?: Record<string, unknown>;
      }): Promise<{ data: { id: number } }>;
    };
  };
}
