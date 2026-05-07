import { Visibility } from './types.js';

export interface ReleaseManifestEntry {
  readonly source: string;
  readonly visibility: Visibility;
}

interface ManifestDocumentYaml {
  source: string;
  visibility?: string;
}

interface ManifestYaml {
  documents?: ManifestDocumentYaml[];
}

export class ReleaseManifest {
  private constructor(
    private readonly entries: Map<string, ReleaseManifestEntry>,
    private readonly isAllPublic: boolean
  ) {}

  static parse(yamlData: ManifestYaml): ReleaseManifest {
    const entries = new Map<string, ReleaseManifestEntry>();

    for (const doc of yamlData.documents ?? []) {
      if (!doc.source) continue;
      entries.set(doc.source, {
        source: doc.source,
        visibility:
          doc.visibility === 'private'
            ? Visibility.Private
            : doc.visibility === 'members'
              ? Visibility.Members
              : Visibility.Public
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
    if (this.isAllPublic) return [];
    return [...this.entries.values()]
      .filter((e) => e.visibility === Visibility.Public)
      .map((e) => e.source);
  }

  listAll(): ReleaseManifestEntry[] {
    return [...this.entries.values()];
  }
}
