import * as core from '@actions/core';

export const logger = {
  info: (msg: string): void => core.info(`[mn-release] ${msg}`),
  warn: (msg: string): void => core.warning(`[mn-release] ${msg}`),
  error: (msg: string): void => core.error(`[mn-release] ${msg}`),
  debug: (msg: string): void => core.debug(`[mn-release] ${msg}`)
};
