import { describe, it, expect } from 'vitest';
import { Channel, ChannelAudience } from '../../src/domain/channel.js';

describe('Channel', () => {
  describe('factory methods', () => {
    it('creates public channel', () => {
      const ch = Channel.public('standards');
      expect(ch.name).toBe('standards');
      expect(ch.audience).toBe(ChannelAudience.Public);
      expect(ch.isPublic).toBe(true);
      expect(ch.toString()).toBe('public/standards');
    });

    it('creates members channel', () => {
      const ch = Channel.members('internal-review');
      expect(ch.audience).toBe(ChannelAudience.Members);
      expect(ch.isPublic).toBe(false);
      expect(ch.toString()).toBe('members/internal-review');
    });

    it('creates internal channel', () => {
      const ch = Channel.internal('ci-artifacts');
      expect(ch.audience).toBe(ChannelAudience.Internal);
      expect(ch.isPublic).toBe(false);
      expect(ch.toString()).toBe('internal/ci-artifacts');
    });
  });

  describe('parse', () => {
    it('parses audience/name format', () => {
      const ch = Channel.parse('public/standards');
      expect(ch.name).toBe('standards');
      expect(ch.audience).toBe(ChannelAudience.Public);
    });

    it('parses members/ format', () => {
      const ch = Channel.parse('members/internal');
      expect(ch.name).toBe('internal');
      expect(ch.audience).toBe(ChannelAudience.Members);
    });

    it('defaults bare name to public audience', () => {
      const ch = Channel.parse('standards');
      expect(ch.name).toBe('standards');
      expect(ch.audience).toBe(ChannelAudience.Public);
    });

    it('parses default channel', () => {
      const ch = Channel.parse('public/default');
      expect(ch.name).toBe('default');
      expect(ch.isPublic).toBe(true);
    });

    it('round-trips through toString()', () => {
      const raw = 'members/internal-review';
      expect(Channel.parse(raw).toString()).toBe(raw);
    });

    it('throws for unknown audience', () => {
      expect(() => Channel.parse('unknown/name')).toThrow(
        'Unknown channel audience'
      );
    });
  });

  describe('equals', () => {
    it('same audience and name are equal', () => {
      const a = Channel.public('standards');
      const b = Channel.public('standards');
      expect(a.equals(b)).toBe(true);
    });

    it('different audience are not equal', () => {
      const a = Channel.public('standards');
      const b = Channel.members('standards');
      expect(a.equals(b)).toBe(false);
    });

    it('different name are not equal', () => {
      const a = Channel.public('standards');
      const b = Channel.public('reports');
      expect(a.equals(b)).toBe(false);
    });
  });
});

describe('ChannelAudience', () => {
  it('parses all valid values', () => {
    expect(ChannelAudience.parse('public')).toBe(ChannelAudience.Public);
    expect(ChannelAudience.parse('members')).toBe(ChannelAudience.Members);
    expect(ChannelAudience.parse('internal')).toBe(ChannelAudience.Internal);
  });

  it('throws for invalid value', () => {
    expect(() => ChannelAudience.parse('foo')).toThrow(
      'Unknown channel audience'
    );
  });
});
