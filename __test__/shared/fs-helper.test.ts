import { describe, it, expect, vi, beforeEach } from 'vitest';
import { directoryExistsSync } from '../../src/shared/fs-helper.js';
import { existsSync, statSync } from 'fs';
import type { Stats } from 'fs';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn()
}));

describe('directoryExistsSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when directory exists', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({
      isDirectory: () => true
    } as Stats);
    expect(directoryExistsSync('/existing')).toBe(true);
  });

  it('returns false when not required and missing', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(directoryExistsSync('/missing', false)).toBe(false);
  });

  it('throws when required and missing', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(() => directoryExistsSync('/missing', true)).toThrow(
      'Directory does not exist'
    );
  });

  it('throws when path is not a directory', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({
      isDirectory: () => false
    } as Stats);
    expect(() => directoryExistsSync('/file')).toThrow(
      'Path is not a directory'
    );
  });
});
