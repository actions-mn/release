import { getInput } from '@actions/core';
import { resolve } from 'path';

export interface ReleaseConfig {
  sourcePath: string;
  outputDir: string;
  releaseConfigFile: string;
  workspacePath: string;

  defaultVisibility: 'public' | 'private';
  force: boolean;
  includePattern: string;
  token: string;

  repo: { owner: string; repo: string };
}

export async function getInputs(): Promise<ReleaseConfig> {
  return {
    sourcePath: getSourcePath(),
    outputDir: getOutputDir(),
    releaseConfigFile: getReleaseConfigFile(),
    workspacePath: getWorkspacePath(),

    defaultVisibility: getDefaultVisibility(),
    force: getBooleanInput('force', 'false'),
    includePattern: getIncludePattern(),
    token: getToken(),

    repo: getRepo()
  };
}

function getSourcePath(): string {
  const input = getInput('source-path') || '.';
  return validatePath(input, 'source-path');
}

function getOutputDir(): string {
  const input = getInput('output-dir') || '_site';
  return validatePath(input, 'output-dir');
}

function getReleaseConfigFile(): string {
  const input = getInput('release-config') || 'metanorma.release.yml';
  validateFilename(input, 'release-config');
  return input;
}

function getIncludePattern(): string {
  return getInput('include-pattern') || '*';
}

function getDefaultVisibility(): 'public' | 'private' {
  const value = getInput('default-visibility') || 'public';
  if (value !== 'public' && value !== 'private') {
    throw new Error(
      `Invalid default-visibility: ${value}. Must be 'public' or 'private'.`
    );
  }
  return value as 'public' | 'private';
}

function getToken(): string {
  const token = getInput('token');
  if (!token) {
    throw new Error('token input is required');
  }
  return token;
}

function getBooleanInput(name: string, defaultVal: string): boolean {
  const value = getInput(name) || defaultVal;
  if (value !== 'true' && value !== 'false') {
    throw new Error(`Invalid boolean value for ${name}: ${value}`);
  }
  return value === 'true';
}

function getWorkspacePath(): string {
  const workspacePath = process.env['GITHUB_WORKSPACE'];
  if (!workspacePath) {
    throw new Error('GITHUB_WORKSPACE not defined');
  }
  return resolve(workspacePath);
}

function getRepo(): { owner: string; repo: string } {
  const repository = process.env['GITHUB_REPOSITORY'];
  if (!repository) {
    throw new Error('GITHUB_REPOSITORY not defined');
  }
  const [owner, repo] = repository.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPOSITORY format: ${repository}`);
  }
  return { owner, repo };
}

export function validatePath(input: string, paramName: string): string {
  if (input.includes('..')) {
    throw new Error(`Path traversal detected in ${paramName}: ${input}`);
  }
  if (input.startsWith('/') && !input.startsWith('/github/workspace')) {
    throw new Error(`Absolute path not allowed in ${paramName}: ${input}`);
  }
  if (input.length > 255) {
    throw new Error(`Path too long in ${paramName} (max 255 characters)`);
  }
  return input;
}

export function validateFilename(filename: string, paramName: string): void {
  if (/[^a-zA-Z0-9._-]/.test(filename)) {
    throw new Error(`Invalid characters in ${paramName}: ${filename}`);
  }
  if (filename.length > 100) {
    throw new Error(`Filename too long in ${paramName} (max 100 characters)`);
  }
}
