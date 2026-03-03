/**
 * Shared HTTP utilities for direct handlers.
 * Lightweight fetch wrappers with timeout support.
 */

import https from 'node:https';
import http from 'node:http';

const DEFAULT_TIMEOUT = 15_000;

export interface FetchOptions {
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
  body?: string;
  timeout?: number;
  /** Use a permissive TLS agent (for .gov sites with cert issues) */
  tlsPermissive?: boolean;
}

/**
 * Low-level HTTPS request using node:https that allows skipping
 * certificate validation (for .gov APIs with self-signed certs).
 */
function httpsRequest(
  url: string,
  opts: FetchOptions,
): Promise<{ status: number; statusText: string; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;

    const reqOpts: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: opts.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...opts.headers,
        ...(opts.body ? { 'Content-Length': Buffer.byteLength(opts.body).toString() } : {}),
      },
      rejectUnauthorized: false,
      timeout: opts.timeout ?? DEFAULT_TIMEOUT,
    };

    const req = mod.request(reqOpts, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer | string) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          statusText: res.statusMessage ?? '',
          body: data,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (opts.body) req.write(opts.body);
    req.end();
  });
}

/**
 * Internal fetch wrapper that applies common options.
 * Uses native fetch for most requests, falls back to node:https
 * for TLS-permissive requests (government APIs with cert issues).
 */
async function _fetch(
  url: string,
  opts: FetchOptions & { accept?: string },
): Promise<{ ok: boolean; status: number; statusText: string; text: () => Promise<string>; json: () => Promise<unknown> }> {
  // For tlsPermissive, use node:https directly
  if (opts.tlsPermissive) {
    const mergedHeaders = {
      ...(opts.accept ? { Accept: opts.accept } : {}),
      ...opts.headers,
    };
    const result = await httpsRequest(url, { ...opts, headers: mergedHeaders });
    const ok = result.status >= 200 && result.status < 300;
    return {
      ok,
      status: result.status,
      statusText: result.statusText,
      text: async () => result.body,
      json: async () => JSON.parse(result.body),
    };
  }

  // Standard fetch path
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    opts.timeout ?? DEFAULT_TIMEOUT,
  );

  try {
    const response = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        ...(opts.accept ? { Accept: opts.accept } : {}),
        ...opts.headers,
      },
      body: opts.body,
      signal: controller.signal,
    });

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch JSON from a URL with timeout and error handling.
 */
export async function fetchJson<T = unknown>(
  url: string,
  opts: FetchOptions = {},
): Promise<T> {
  const response = await _fetch(url, { ...opts, accept: 'application/json' });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `HTTP ${response.status}: ${text.slice(0, 200) || response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

/**
 * Fetch raw text from a URL (for HTML extraction, XML feeds, etc.)
 */
export async function fetchText(
  url: string,
  opts: FetchOptions = {},
): Promise<string> {
  const response = await _fetch(url, opts);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.text();
}
