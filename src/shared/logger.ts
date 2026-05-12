import * as core from '@actions/core';

export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  debug(msg: string): void;
  scoped(suffix: string): Logger;
}

export class PrefixLogger implements Logger {
  constructor(private readonly prefix: string) {}

  info(msg: string): void {
    core.info(`${this.prefix} ${msg}`);
  }

  warn(msg: string): void {
    core.warning(`${this.prefix} ${msg}`);
  }

  error(msg: string): void {
    core.error(`${this.prefix} ${msg}`);
  }

  debug(msg: string): void {
    core.debug(`${this.prefix} ${msg}`);
  }

  scoped(suffix: string): Logger {
    return new PrefixLogger(`${this.prefix}:${suffix}`);
  }
}

export const logger = new PrefixLogger('[mn-release]');
