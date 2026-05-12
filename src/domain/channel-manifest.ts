import { Channel } from './channel.js';
import { logger } from '../shared/logger.js';
import { minimatch } from 'minimatch';

export interface ManifestEntry {
  readonly source?: string;
  readonly pattern?: string;
  readonly stages?: readonly string[];
  readonly visibility: 'public' | 'private' | 'members';
  readonly channels: readonly Channel[];
}

interface ManifestEntryYaml {
  source?: string;
  pattern?: string;
  stages?: string[];
  visibility?: string;
  channels?: string[];
}

interface ManifestYaml {
  defaults?: {
    visibility?: string;
    channels?: string[];
  };
  documents?: ManifestEntryYaml[];
}

export class DocumentReleasePolicy {
  private constructor(
    readonly shouldRelease: boolean,
    readonly channels: readonly Channel[],
    readonly stageAllowList: ReadonlySet<string> | undefined
  ) {}

  static fromDefaults(
    defaultVisibility: 'public' | 'private' | 'members',
    defaultChannels: Channel[]
  ): DocumentReleasePolicy {
    if (defaultVisibility === 'private') {
      return new DocumentReleasePolicy(false, [], undefined);
    }
    return new DocumentReleasePolicy(true, defaultChannels, undefined);
  }

  static fromEntry(entry: ManifestEntry): DocumentReleasePolicy {
    if (entry.visibility === 'private') {
      return new DocumentReleasePolicy(false, [], undefined);
    }
    const stageSet =
      entry.stages && entry.stages.length > 0
        ? new Set(entry.stages)
        : undefined;
    return new DocumentReleasePolicy(true, entry.channels, stageSet);
  }
}

export class ChannelManifest {
  private constructor(
    private readonly entries: readonly ManifestEntry[],
    private readonly defaultVisibility: 'public' | 'private' | 'members',
    private readonly defaultChannels: readonly Channel[],
    private readonly isExplicitlyLoaded: boolean
  ) {}

  static parse(yamlData: ManifestYaml): ChannelManifest {
    const defaults = yamlData.defaults ?? {};
    const defaultVisibility = parseVisibility(defaults.visibility) ?? 'public';
    const defaultChannels = parseChannels(defaults.channels, defaultVisibility);

    // When loaded from a file, unlisted documents default to private
    // unless defaults.visibility is explicitly set
    const effectiveVisibility = defaults.visibility
      ? defaultVisibility
      : 'private';

    const entries: ManifestEntry[] = [];
    const seenSources = new Set<string>();

    for (const doc of yamlData.documents ?? []) {
      if (!doc.source && !doc.pattern) {
        logger.warn('Release manifest entry missing source/pattern — skipping');
        continue;
      }

      if (doc.source) {
        if (doc.source.includes('..')) {
          throw new Error(
            `Path traversal in release manifest source: "${doc.source}"`
          );
        }
        if (seenSources.has(doc.source)) {
          logger.warn(
            `Duplicate source in release manifest: "${doc.source}" — using last entry`
          );
        }
        seenSources.add(doc.source);
      }

      const visibility = parseVisibility(doc.visibility) ?? defaultVisibility;
      const channels = parseChannels(doc.channels, visibility);

      entries.push({
        source: doc.source,
        pattern: doc.pattern,
        stages: doc.stages,
        visibility,
        channels
      });
    }

    return new ChannelManifest(
      entries,
      effectiveVisibility,
      defaultChannels,
      true
    );
  }

  static allPublic(): ChannelManifest {
    return new ChannelManifest(
      [],
      'public',
      [Channel.public('default')],
      false
    );
  }

  static allPrivate(): ChannelManifest {
    return new ChannelManifest([], 'private', [], true);
  }

  resolve(doc: {
    sourcePath: string;
    id: { toString(): string };
  }): DocumentReleasePolicy {
    if (!this.isExplicitlyLoaded) {
      return DocumentReleasePolicy.fromDefaults('public', [
        Channel.public('default')
      ]);
    }

    const entry = this.findEntry(doc);
    if (!entry) {
      return DocumentReleasePolicy.fromDefaults(this.defaultVisibility, [
        ...this.defaultChannels
      ]);
    }

    return DocumentReleasePolicy.fromEntry(entry);
  }

  listAll(): ManifestEntry[] {
    return [...this.entries];
  }

  private findEntry(doc: {
    sourcePath: string;
    id: { toString(): string };
  }): ManifestEntry | undefined {
    return this.entries.find((e) => {
      if (e.source && e.source === doc.sourcePath) return true;
      if (e.pattern && minimatch(doc.id.toString(), e.pattern)) return true;
      return false;
    });
  }
}

function parseVisibility(
  raw: string | undefined
): 'public' | 'private' | 'members' | undefined {
  if (!raw) return undefined;
  if (raw === 'public' || raw === 'private' || raw === 'members') return raw;
  throw new Error(`Invalid visibility: ${raw}`);
}

function parseChannels(
  raw: readonly string[] | undefined,
  visibility: 'public' | 'private' | 'members'
): Channel[] {
  if (raw && raw.length > 0) {
    return raw.map((s) => Channel.parse(s));
  }
  switch (visibility) {
    case 'members':
      return [Channel.members('default')];
    case 'public':
      return [Channel.public('default')];
    default:
      return [];
  }
}
