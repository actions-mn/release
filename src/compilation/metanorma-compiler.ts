import { exec } from '@actions/exec';
import { info, exportVariable } from '@actions/core';
import { Version, MINIMUM_MODERN_VERSION } from '../shared/version-helper.js';
import type { ICompiler } from '../domain/types.js';

export interface CompilationConfig {
  sourcePath: string;
  outputDir: string;
  configFile: string;
  agreeToTerms: boolean;
  installFonts: boolean;
  continueWithoutFonts: boolean;
  useBundler: boolean;
}

export class MetanormaCompiler implements ICompiler {
  private version?: Version;

  constructor(private readonly config: CompilationConfig) {}

  async compile(): Promise<string> {
    this.version = await this.getVersion();
    info(`Metanorma version: ${this.version}`);

    const cmdArray = this.buildCommand(this.version);
    info(`Executing: ${cmdArray.join(' ')}`);

    if (this.config.useBundler) {
      await exec('bundle', ['exec', ...cmdArray], {
        cwd: this.config.sourcePath
      });
    } else {
      await exec(cmdArray[0], cmdArray.slice(1), {
        cwd: this.config.sourcePath
      });
    }

    exportVariable('METANORMA_CMD', this.getCommand());
    return this.version.toString();
  }

  private async getVersion(): Promise<Version> {
    const cmd = this.getCommand();
    let output = '';

    const versionCmd = this.config.useBundler
      ? ['bundle', 'exec', cmd, '--version']
      : [cmd, '--version'];

    await exec(versionCmd[0], versionCmd.slice(1), {
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString();
        },
        stderr: (data: Buffer) => {
          output += data.toString();
        }
      }
    });

    const lines = output.split('\n');
    for (const line of lines) {
      const match = line.match(/Metanorma\s+(\d+\.\d+\.\d+)/);
      if (match) {
        return Version.parse(match[1]);
      }
    }

    throw new Error(
      `Failed to parse metanorma version from output:\n${output}`
    );
  }

  private buildCommand(version: Version): string[] {
    const cmd = this.getCommand();
    const args: string[] = [
      'site',
      'generate',
      '.',
      '-o',
      this.config.outputDir,
      '-c',
      this.config.configFile
    ];

    if (this.config.agreeToTerms) {
      args.push('--agree-to-terms');
    }

    if (this.config.installFonts) {
      if (version.lt(MINIMUM_MODERN_VERSION)) {
        args.push('--no-no-install-fonts');
      } else {
        args.push('--install-fonts');
      }
    } else {
      args.push('--no-install-fonts');
    }

    if (this.config.continueWithoutFonts) {
      args.push('--continue-without-fonts');
    } else {
      args.push('--no-continue-without-fonts');
    }

    args.push('--no-progress');

    return [cmd, ...args];
  }

  private getCommand(): string {
    const isWindows = process.platform === 'win32';
    return isWindows ? 'metanorma.exe' : 'metanorma';
  }
}
