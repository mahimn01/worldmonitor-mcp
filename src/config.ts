/**
 * Configuration loading — reads from environment variables and .env files.
 */

import { ClientConfig } from './types.js';

const DEFAULT_BASE_URL = 'https://worldmonitor.app';
const DEFAULT_TIMEOUT = 30_000;

export function loadConfig(overrides?: Partial<ClientConfig>): ClientConfig {
  return {
    baseUrl:
      overrides?.baseUrl ??
      process.env.WORLDMONITOR_BASE_URL ??
      DEFAULT_BASE_URL,
    apiKey: overrides?.apiKey ?? process.env.WORLDMONITOR_API_KEY ?? undefined,
    timeout:
      overrides?.timeout ??
      (process.env.WORLDMONITOR_TIMEOUT
        ? parseInt(process.env.WORLDMONITOR_TIMEOUT, 10)
        : DEFAULT_TIMEOUT),
  };
}
