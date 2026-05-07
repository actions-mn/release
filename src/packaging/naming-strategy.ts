import {
  type DocumentId,
  type DocumentVersion,
  ReleaseTag
} from '../domain/types.js';
import {
  DocumentType,
  type DocumentMetadata
} from '../domain/document-metadata.js';

export interface INamingStrategy {
  computeTag(id: DocumentId, version: DocumentVersion): ReleaseTag;
  computeAssetName(id: DocumentId, version: DocumentVersion): string;
  computeCanonicalBase(id: DocumentId, version: DocumentVersion): string;
}

export class StandardNamingStrategy implements INamingStrategy {
  computeTag(id: DocumentId, version: DocumentVersion): ReleaseTag {
    return ReleaseTag.from(id, version);
  }

  computeAssetName(id: DocumentId, version: DocumentVersion): string {
    return version.toFileName(id);
  }

  computeCanonicalBase(id: DocumentId, version: DocumentVersion): string {
    const suffix = version.tagComponent;
    return `${id.fileName}-${suffix}`;
  }
}

export class IetfDraftNamingStrategy implements INamingStrategy {
  computeTag(id: DocumentId, version: DocumentVersion): ReleaseTag {
    const raw = id.toString();
    const match = raw.match(/^draft-(ietf)-([a-z]+)-(.+)-(\d+)$/);
    if (!match) {
      return ReleaseTag.from(id, version);
    }

    const [, , org, name, draftVersion] = match;
    return ReleaseTag.create(`id-${org}-${name}/${draftVersion}`, true);
  }

  computeAssetName(id: DocumentId, _version: DocumentVersion): string {
    return `${id.fileName}.zip`;
  }

  computeCanonicalBase(id: DocumentId, _version: DocumentVersion): string {
    return id.fileName;
  }
}

export class IetfRfcNamingStrategy implements INamingStrategy {
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

export function getNamingStrategy(documentType: DocumentType): INamingStrategy {
  switch (documentType) {
    case DocumentType.IetfDraft:
      return new IetfDraftNamingStrategy();
    case DocumentType.IetfRfc:
      return new IetfRfcNamingStrategy();
    default:
      return new StandardNamingStrategy();
  }
}

export function buildTag(metadata: DocumentMetadata): ReleaseTag {
  const strategy = getNamingStrategy(metadata.documentType);
  return strategy.computeTag(metadata.id, metadata.version);
}
