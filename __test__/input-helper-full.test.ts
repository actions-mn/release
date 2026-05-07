import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getInputs } from '../src/input-helper.js';

describe('getInputs', () => {
  beforeEach(() => {
    vi.stubEnv('GITHUB_WORKSPACE', '/github/workspace');
    vi.stubEnv('GITHUB_REPOSITORY', 'owner/repo');
  });

  afterEach(() => {
    // Clean up all INPUT_ vars
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('INPUT_')) {
        delete process.env[key];
      }
    }
    vi.unstubAllEnvs();
  });

  function setInput(name: string, value: string) {
    vi.stubEnv(`INPUT_${name.replace(/ /g, '_').toUpperCase()}`, value);
  }

  it('returns defaults when minimal inputs provided', async () => {
    setInput('token', 'ghp_test123');

    const config = await getInputs();

    expect(config.sourcePath).toBe('.');
    expect(config.outputDir).toBe('_site');
    expect(config.configFile).toBe('metanorma.yml');
    expect(config.releaseConfigFile).toBe('metanorma.release.yml');
    expect(config.agreeToTerms).toBe(true);
    expect(config.installFonts).toBe(true);
    expect(config.continueWithoutFonts).toBe(true);
    expect(config.useBundler).toBe(false);
    expect(config.force).toBe(false);
    expect(config.includePattern).toBe('*');
    expect(config.token).toBe('ghp_test123');
    expect(config.repo).toEqual({ owner: 'owner', repo: 'repo' });
    expect(config.workspacePath).toBe('/github/workspace');
  });

  it('reads custom inputs', async () => {
    setInput('source-path', 'custom-source');
    setInput('output-dir', 'custom-output');
    setInput('config-file', 'custom.yml');
    setInput('release-config', 'custom.release.yml');
    setInput('agree-to-terms', 'false');
    setInput('install-fonts', 'false');
    setInput('continue-without-fonts', 'false');
    setInput('use-bundler', 'true');
    setInput('force', 'true');
    setInput('include-pattern', 'cc-*');
    setInput('token', 'ghp_custom');

    const config = await getInputs();

    expect(config.sourcePath).toBe('custom-source');
    expect(config.outputDir).toBe('custom-output');
    expect(config.configFile).toBe('custom.yml');
    expect(config.releaseConfigFile).toBe('custom.release.yml');
    expect(config.agreeToTerms).toBe(false);
    expect(config.installFonts).toBe(false);
    expect(config.continueWithoutFonts).toBe(false);
    expect(config.useBundler).toBe(true);
    expect(config.force).toBe(true);
    expect(config.includePattern).toBe('cc-*');
    expect(config.repo).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('throws when GITHUB_WORKSPACE is not set', async () => {
    vi.stubEnv('GITHUB_WORKSPACE', '');
    setInput('token', 'test');

    await expect(getInputs()).rejects.toThrow('GITHUB_WORKSPACE not defined');
  });

  it('throws when GITHUB_REPOSITORY is not set', async () => {
    vi.stubEnv('GITHUB_REPOSITORY', '');
    setInput('token', 'test');

    await expect(getInputs()).rejects.toThrow('GITHUB_REPOSITORY not defined');
  });

  it('throws for invalid boolean input', async () => {
    setInput('agree-to-terms', 'maybe');
    setInput('token', 'test');

    await expect(getInputs()).rejects.toThrow('Invalid boolean value');
  });

  it('throws for invalid GITHUB_REPOSITORY format', async () => {
    vi.stubEnv('GITHUB_REPOSITORY', 'invalid-no-slash');
    setInput('token', 'test');

    await expect(getInputs()).rejects.toThrow(
      'Invalid GITHUB_REPOSITORY format'
    );
  });
});
