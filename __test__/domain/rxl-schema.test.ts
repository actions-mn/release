import { describe, it, expect } from 'vitest';
import { textOf } from '../../src/domain/rxl-schema.js';

describe('textOf', () => {
  it('returns undefined for undefined', () => {
    expect(textOf(undefined)).toBeUndefined();
  });

  it('returns string as-is', () => {
    expect(textOf('hello')).toBe('hello');
  });

  it('extracts #text from object', () => {
    expect(textOf({ '#text': 'value' })).toBe('value');
  });

  it('returns undefined for object without #text', () => {
    expect(textOf({ '#text': undefined })).toBeUndefined();
  });

  it('returns empty string from #text', () => {
    expect(textOf({ '#text': '' })).toBe('');
  });
});
