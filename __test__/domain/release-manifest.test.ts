import { describe, it, expect } from 'vitest';
import { ReleaseManifest } from '../../src/domain/release-manifest.js';
import { Visibility } from '../../src/domain/types.js';

describe('ReleaseManifest', () => {
  describe('parse', () => {
    it('parses valid manifest with mixed visibility', () => {
      const manifest = ReleaseManifest.parse({
        documents: [
          { source: 'sources/cc-51015.adoc' },
          { source: 'sources/cc-51026.adoc', visibility: 'private' },
          { source: 'sources/cc-51024.adoc', visibility: 'members' }
        ]
      });

      expect(manifest.isPublic('sources/cc-51015.adoc')).toBe(true);
      expect(manifest.isPublic('sources/cc-51026.adoc')).toBe(false);
      expect(manifest.getVisibility('sources/cc-51026.adoc')).toBe(
        Visibility.Private
      );
      expect(manifest.getVisibility('sources/cc-51024.adoc')).toBe(
        Visibility.Members
      );
    });

    it('defaults visibility to public', () => {
      const manifest = ReleaseManifest.parse({
        documents: [{ source: 'sources/cc-51015.adoc' }]
      });
      expect(manifest.isPublic('sources/cc-51015.adoc')).toBe(true);
    });

    it('empty documents array', () => {
      const manifest = ReleaseManifest.parse({ documents: [] });
      expect(manifest.isPublic('sources/cc-51015.adoc')).toBe(false);
    });

    it('handles undefined documents', () => {
      const manifest = ReleaseManifest.parse({});
      expect(manifest.isPublic('sources/cc-51015.adoc')).toBe(false);
    });

    it('skips entries without source', () => {
      const manifest = ReleaseManifest.parse({
        documents: [{ source: '' }, { source: 'sources/cc-51015.adoc' }]
      });
      expect(manifest.listAll()).toHaveLength(1);
    });
  });

  describe('allPublic', () => {
    it('returns public for any path', () => {
      const manifest = ReleaseManifest.allPublic();
      expect(manifest.isPublic('sources/cc-51015.adoc')).toBe(true);
      expect(manifest.isPublic('anything')).toBe(true);
    });

    it('listPublic returns empty (meaning all)', () => {
      const manifest = ReleaseManifest.allPublic();
      expect(manifest.listPublic()).toEqual([]);
    });
  });

  describe('listPublic', () => {
    it('returns only public sources', () => {
      const manifest = ReleaseManifest.parse({
        documents: [
          { source: 'sources/cc-51015.adoc' },
          { source: 'sources/cc-51026.adoc', visibility: 'private' },
          { source: 'sources/cc-51024.adoc' }
        ]
      });

      const publicDocs = manifest.listPublic();
      expect(publicDocs).toContain('sources/cc-51015.adoc');
      expect(publicDocs).toContain('sources/cc-51024.adoc');
      expect(publicDocs).not.toContain('sources/cc-51026.adoc');
    });
  });

  describe('unlisted documents', () => {
    it('returns private for unlisted when manifest exists', () => {
      const manifest = ReleaseManifest.parse({
        documents: [{ source: 'sources/cc-51015.adoc' }]
      });
      expect(manifest.isPublic('sources/unknown.adoc')).toBe(false);
    });
  });
});
