/**
 * Tests for configuration loading.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../config.js';

describe('loadConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should use defaults when no env vars or overrides', () => {
    delete process.env.WORLDMONITOR_BASE_URL;
    delete process.env.WORLDMONITOR_API_KEY;
    delete process.env.WORLDMONITOR_TIMEOUT;

    const config = loadConfig();
    expect(config.baseUrl).toBe('https://worldmonitor.app');
    expect(config.apiKey).toBeUndefined();
    expect(config.timeout).toBe(30000);
  });

  it('should read from environment variables', () => {
    process.env.WORLDMONITOR_BASE_URL = 'https://custom.app';
    process.env.WORLDMONITOR_API_KEY = 'my-key';
    process.env.WORLDMONITOR_TIMEOUT = '5000';

    const config = loadConfig();
    expect(config.baseUrl).toBe('https://custom.app');
    expect(config.apiKey).toBe('my-key');
    expect(config.timeout).toBe(5000);
  });

  it('should prefer overrides over env vars', () => {
    process.env.WORLDMONITOR_BASE_URL = 'https://env.app';

    const config = loadConfig({ baseUrl: 'https://override.app' });
    expect(config.baseUrl).toBe('https://override.app');
  });

  it('should handle partial overrides', () => {
    const config = loadConfig({ timeout: 1000 });
    expect(config.baseUrl).toBe('https://worldmonitor.app');
    expect(config.timeout).toBe(1000);
  });

  it('should default dataDir and cacheTtlSeconds', () => {
    delete process.env.WORLDMONITOR_DATA_DIR;
    delete process.env.WORLDMONITOR_CACHE_TTL;
    const config = loadConfig();
    expect(config.dataDir).toMatch(/[\\/]\.cache[\\/]worldmonitor$/);
    expect(config.cacheTtlSeconds).toBe(900);
  });

  it('should resolve watchlist from env (precedence over file/default)', () => {
    process.env.WORLDMONITOR_WATCHLIST = 'nvda, amzn ,tsla';
    const config = loadConfig({ dataDir: '/nonexistent-dir-xyz' });
    expect(config.watchlist).toEqual(['NVDA', 'AMZN', 'TSLA']);
    expect(config.watchlistSource).toBe('env');
  });

  it('should fall back to the default watchlist', () => {
    delete process.env.WORLDMONITOR_WATCHLIST;
    const config = loadConfig({ dataDir: '/nonexistent-dir-xyz' });
    expect(config.watchlist).toEqual(['SPY', 'QQQ', '^VIX']);
    expect(config.watchlistSource).toBe('default');
  });
});
