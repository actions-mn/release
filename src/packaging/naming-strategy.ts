import {
  type DocumentId,
  type DocumentVersion,
  ReleaseTag
} from '../domain/types.js';
import { DocumentType } from '../domain/document-metadata.js';

export interface INamingStrategy {
  computeTag(id: DocumentId, version: DocumentVersion): ReleaseTag;
  computeAssetName(id: DocumentId, version: DocumentVersion): string;
  computeCanonicalBase(id: DocumentId, version: DocumentVersion): string;
}

// Tag: {id}/ed{edition}[-{stage}]
// Asset: {id}-ed{edition}[-{stage}].zip
// Used by: CC, ISO, IEC, ITU, BIPM, OIML, UN, CSA, M3AAWG, MPFA, PDFA, Ribose, and unknown
export class EditionNamingStrategy implements INamingStrategy {
  computeTag(id: DocumentId, version: DocumentVersion): ReleaseTag {
    return ReleaseTag.from(id, version);
  }

  computeAssetName(id: DocumentId, version: DocumentVersion): string {
    return version.toFileName(id);
  }

  computeCanonicalBase(id: DocumentId, version: DocumentVersion): string {
    return `${id.fileName}-${version.tagComponent}`;
  }
}

// Tag: {id}/v{edition}
// Asset: {id}-v{edition}.zip
// Used by: IHO, OGC, and any identifier that uses version-style edition numbering
export class VersionNamingStrategy implements INamingStrategy {
  computeTag(id: DocumentId, version: DocumentVersion): ReleaseTag {
    return ReleaseTag.create(
      `${id.tagPrefix}/v${version.editionNumber}`,
      false
    );
  }

  computeAssetName(id: DocumentId, version: DocumentVersion): string {
    return `${id.fileName}-v${version.editionNumber}.zip`;
  }

  computeCanonicalBase(id: DocumentId, version: DocumentVersion): string {
    return `${id.fileName}-v${version.editionNumber}`;
  }
}

// Extracts draft version from IETF Internet-Draft identifier pattern:
//   draft-ietf-{name}-{N} → tag: id-{name}/{N}, asset: draft-ietf-{name}-{N}.zip
// Falls back to {id}/draft for non-matching identifiers.
export class InternetDraftNamingStrategy implements INamingStrategy {
  computeTag(id: DocumentId, _version: DocumentVersion): ReleaseTag {
    const raw = id.toString();
    const match = raw.match(/^draft-(?:ietf-)?([a-z]+(?:-[a-z]+)*)-(\d+)$/);
    if (!match) {
      return ReleaseTag.create(`${raw}/draft`, true);
    }

    const [, name, draftVersion] = match;
    return ReleaseTag.create(`id-${name}/${draftVersion}`, true);
  }

  computeAssetName(id: DocumentId, _version: DocumentVersion): string {
    return `${id.fileName}.zip`;
  }

  computeCanonicalBase(id: DocumentId, _version: DocumentVersion): string {
    return id.fileName;
  }
}

// Tag: {id}/ed{edition}
// Asset: {id}.zip (stable — edition not in asset name)
// Used by: RFCs where the asset name doesn't vary across editions
export class RfcNamingStrategy implements INamingStrategy {
  computeTag(id: DocumentId, version: DocumentVersion): ReleaseTag {
    return ReleaseTag.from(id, version);
  }

  computeAssetName(id: DocumentId, _version: DocumentVersion): string {
    return `${id.fileName}.zip`;
  }

  computeCanonicalBase(id: DocumentId, version: DocumentVersion): string {
    return `${id.fileName}-${version.tagComponent}`;
  }
}

// Extracts draft version from identifier suffix: {id}-d{N} → tag: {id}/{N}
// Falls back to edition-based naming when no draft suffix is present.
// Used by: IEEE draft identifiers (e.g., ieee-draft-std-987-6-2020-d3)
export class DraftSuffixNamingStrategy implements INamingStrategy {
  private static readonly DRAFT_SUFFIX = /-d(\d+)$/;

  computeTag(id: DocumentId, version: DocumentVersion): ReleaseTag {
    const raw = id.toString();
    const match = raw.match(DraftSuffixNamingStrategy.DRAFT_SUFFIX);
    if (match) {
      const base = raw.replace(DraftSuffixNamingStrategy.DRAFT_SUFFIX, '');
      return ReleaseTag.create(`${base}/${match[1]}`, true);
    }
    return ReleaseTag.from(id, version);
  }

  computeAssetName(id: DocumentId, _version: DocumentVersion): string {
    return `${id.fileName}.zip`;
  }

  computeCanonicalBase(id: DocumentId, _version: DocumentVersion): string {
    return id.fileName;
  }
}

export class NamingStrategyRegistry {
  private readonly strategies = new Map<DocumentType, INamingStrategy>();
  private readonly defaultStrategy: INamingStrategy;

  constructor(defaultStrategy: INamingStrategy) {
    this.defaultStrategy = defaultStrategy;
  }

  register(type: DocumentType, strategy: INamingStrategy): void {
    this.strategies.set(type, strategy);
  }

  resolve(type: DocumentType): INamingStrategy {
    return this.strategies.get(type) ?? this.defaultStrategy;
  }
}

export function createDefaultRegistry(): NamingStrategyRegistry {
  const registry = new NamingStrategyRegistry(new EditionNamingStrategy());
  registry.register(DocumentType.IetfDraft, new InternetDraftNamingStrategy());
  registry.register(DocumentType.IetfRfc, new RfcNamingStrategy());
  registry.register(DocumentType.Ieee, new DraftSuffixNamingStrategy());
  const versionStrategy = new VersionNamingStrategy();
  registry.register(DocumentType.Iho, versionStrategy);
  registry.register(DocumentType.Ogc, versionStrategy);
  return registry;
}
