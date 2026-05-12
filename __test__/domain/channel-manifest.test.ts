import { describe, it, expect } from 'vitest';
import {
  ChannelManifest,
  DocumentReleasePolicy
} from '../../src/domain/channel-manifest.js';
import { Channel, ChannelAudience } from '../../src/domain/channel.js';

function mockDoc(sourcePath: string, id: string) {
  return { sourcePath, id: { toString: () => id } };
}

describe('ChannelManifest', () => {
  describe('allPublic', () => {
    it('returns public policy for any document', () => {
      const manifest = ChannelManifest.allPublic();
      const policy = manifest.resolve(mockDoc('any/path.adoc', 'cc-51015'));
      expect(policy.shouldRelease).toBe(true);
      expect(policy.channels).toHaveLength(1);
      expect(policy.channels[0].toString()).toBe('public/default');
    });

    it('resolve returns shouldRelease=true for any doc', () => {
      const manifest = ChannelManifest.allPublic();
      expect(manifest.resolve(mockDoc('anything', 'cc-1')).shouldRelease).toBe(
        true
      );
    });
  });

  describe('allPrivate', () => {
    it('returns no-release policy', () => {
      const manifest = ChannelManifest.allPrivate();
      const policy = manifest.resolve(mockDoc('any/path.adoc', 'cc-51015'));
      expect(policy.shouldRelease).toBe(false);
    });
  });

  describe('parse — old format (visibility only)', () => {
    it('maps public visibility to public/default channel', () => {
      const manifest = ChannelManifest.parse({
        documents: [{ source: 'sources/cc-51015.adoc' }]
      });
      const policy = manifest.resolve(
        mockDoc('sources/cc-51015.adoc', 'cc-51015')
      );
      expect(policy.shouldRelease).toBe(true);
      expect(policy.channels[0].toString()).toBe('public/default');
    });

    it('maps private visibility to no release', () => {
      const manifest = ChannelManifest.parse({
        documents: [{ source: 'sources/cc-51015.adoc', visibility: 'private' }]
      });
      const policy = manifest.resolve(
        mockDoc('sources/cc-51015.adoc', 'cc-51015')
      );
      expect(policy.shouldRelease).toBe(false);
    });

    it('maps members visibility to members/default channel', () => {
      const manifest = ChannelManifest.parse({
        documents: [{ source: 'sources/cc-51015.adoc', visibility: 'members' }]
      });
      const policy = manifest.resolve(
        mockDoc('sources/cc-51015.adoc', 'cc-51015')
      );
      expect(policy.shouldRelease).toBe(true);
      expect(policy.channels[0].audience).toBe(ChannelAudience.Members);
    });

    it('unlisted documents are private when file exists', () => {
      const manifest = ChannelManifest.parse({
        documents: [{ source: 'sources/cc-51015.adoc' }]
      });
      const policy = manifest.resolve(mockDoc('sources/other.adoc', 'other'));
      expect(policy.shouldRelease).toBe(false);
    });
  });

  describe('parse — new format (channels)', () => {
    it('parses channel strings', () => {
      const manifest = ChannelManifest.parse({
        documents: [
          {
            source: 'sources/cc-51015.adoc',
            channels: ['public/standards', 'public/admin-reports']
          }
        ]
      });
      const policy = manifest.resolve(
        mockDoc('sources/cc-51015.adoc', 'cc-51015')
      );
      expect(policy.shouldRelease).toBe(true);
      expect(policy.channels).toHaveLength(2);
      expect(policy.channels[0].toString()).toBe('public/standards');
      expect(policy.channels[1].toString()).toBe('public/admin-reports');
    });

    it('parses members channel', () => {
      const manifest = ChannelManifest.parse({
        documents: [
          {
            source: 'sources/cc-internal.adoc',
            channels: ['members/internal-review']
          }
        ]
      });
      const policy = manifest.resolve(
        mockDoc('sources/cc-internal.adoc', 'cc-internal')
      );
      expect(policy.channels[0].audience).toBe(ChannelAudience.Members);
    });
  });

  describe('parse — pattern matching', () => {
    it('matches documents by pattern', () => {
      const manifest = ChannelManifest.parse({
        documents: [
          {
            pattern: 'cc-0*',
            channels: ['public/archive']
          }
        ]
      });
      const policy = manifest.resolve(
        mockDoc('sources/cc-0100.adoc', 'cc-0100')
      );
      expect(policy.shouldRelease).toBe(true);
      expect(policy.channels[0].toString()).toBe('public/archive');
    });

    it('does not match non-matching patterns', () => {
      const manifest = ChannelManifest.parse({
        documents: [
          {
            pattern: 'cc-0*',
            channels: ['public/archive']
          }
        ]
      });
      const policy = manifest.resolve(
        mockDoc('sources/iso-8601.adoc', 'iso-8601')
      );
      expect(policy.shouldRelease).toBe(false);
    });
  });

  describe('parse — stage constraints', () => {
    it('stores stage allow list in policy', () => {
      const manifest = ChannelManifest.parse({
        documents: [
          {
            source: 'sources/cc-51015.adoc',
            stages: ['published']
          }
        ]
      });
      const policy = manifest.resolve(
        mockDoc('sources/cc-51015.adoc', 'cc-51015')
      );
      expect(policy.stageAllowList).toBeDefined();
      expect(policy.stageAllowList!.has('published')).toBe(true);
    });

    it('undefined stages when not specified', () => {
      const manifest = ChannelManifest.parse({
        documents: [{ source: 'sources/cc-51015.adoc' }]
      });
      const policy = manifest.resolve(
        mockDoc('sources/cc-51015.adoc', 'cc-51015')
      );
      expect(policy.stageAllowList).toBeUndefined();
    });
  });

  describe('parse — defaults section', () => {
    it('uses default visibility for unlisted docs when set', () => {
      const manifest = ChannelManifest.parse({
        defaults: { visibility: 'public' },
        documents: [{ source: 'sources/cc-51015.adoc' }]
      });
      const policy = manifest.resolve(mockDoc('sources/other.adoc', 'other'));
      expect(policy.shouldRelease).toBe(true);
    });

    it('uses default channels for unlisted docs', () => {
      const manifest = ChannelManifest.parse({
        defaults: {
          visibility: 'public',
          channels: ['public/standards']
        },
        documents: []
      });
      const policy = manifest.resolve(mockDoc('sources/other.adoc', 'other'));
      expect(policy.channels[0].toString()).toBe('public/standards');
    });
  });

  describe('resolve — visibility', () => {
    it('returns shouldRelease=true for public entries', () => {
      const manifest = ChannelManifest.parse({
        documents: [{ source: 'sources/cc-51015.adoc' }]
      });
      expect(
        manifest.resolve(mockDoc('sources/cc-51015.adoc', 'cc-51015'))
          .shouldRelease
      ).toBe(true);
    });

    it('returns shouldRelease=false for private entries', () => {
      const manifest = ChannelManifest.parse({
        documents: [{ source: 'sources/cc-51015.adoc', visibility: 'private' }]
      });
      expect(
        manifest.resolve(mockDoc('sources/cc-51015.adoc', 'cc-51015'))
          .shouldRelease
      ).toBe(false);
    });

    it('returns shouldRelease=true for members entries', () => {
      const manifest = ChannelManifest.parse({
        documents: [{ source: 'sources/cc-51015.adoc', visibility: 'members' }]
      });
      expect(
        manifest.resolve(mockDoc('sources/cc-51015.adoc', 'cc-51015'))
          .shouldRelease
      ).toBe(true);
    });
  });

  describe('listAll', () => {
    it('returns all entries', () => {
      const manifest = ChannelManifest.parse({
        documents: [
          { source: 'a.adoc' },
          { source: 'b.adoc', visibility: 'private' }
        ]
      });
      expect(manifest.listAll()).toHaveLength(2);
    });
  });
});
