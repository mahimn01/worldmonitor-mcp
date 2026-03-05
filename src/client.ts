/**
 * HTTP client for the World Monitor API.
 *
 * Supports both proto-style endpoints (/api/{service}/v1/{rpc}) and legacy
 * endpoints (/api/{name}).  Returns structured ApiResponse objects.
 *
 * Enterprise features:
 * - Retry with exponential backoff for transient failures
 * - Response validation (detects HTML/source-code responses)
 * - Configurable timeout
 */

import { ClientConfig, ApiResponse, ApiError } from './types.js';

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1000;

function isRetryable(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class WorldMonitorClient {
  private config: ClientConfig;

  constructor(config: ClientConfig) {
    this.config = config;
  }

  /**
   * Call an API endpoint with retry logic.
   *
   * @param path   - Full path (e.g. "/api/military/v1/list-military-flights")
   * @param params - Query parameters (GET) or JSON body (POST)
   * @param method - HTTP method (default: GET)
   */
  async call<T = unknown>(
    path: string,
    params?: Record<string, unknown>,
    method: 'GET' | 'POST' = 'GET',
  ): Promise<ApiResponse<T> | ApiError> {
    const url = new URL(path, this.config.baseUrl);

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    let body: string | undefined;

    if (params && method === 'GET') {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            url.searchParams.set(key, value.join(','));
          } else {
            url.searchParams.set(key, String(value));
          }
        }
      }
    } else if (params && method === 'POST') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(params);
    }

    let lastError: ApiError | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const backoff = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await delay(backoff);
      }

      const start = Date.now();

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.timeout,
        );

        const response = await fetch(url.toString(), {
          method,
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const elapsed = Date.now() - start;

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((v, k) => {
          responseHeaders[k] = v;
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');

          // Retry on transient failures
          if (isRetryable(response.status) && attempt < MAX_RETRIES) {
            lastError = {
              ok: false,
              status: response.status,
              message: text || response.statusText,
              elapsed,
            };
            continue;
          }

          return {
            ok: false,
            status: response.status,
            message: text || response.statusText,
            elapsed,
          };
        }

        const contentType = response.headers.get('content-type') ?? '';

        // Validate response is actually JSON (detect source code / HTML responses)
        if (!contentType.includes('application/json')) {
          const text = await response.text();

          // Check for HTML/source code responses (broken serverless functions)
          const trimmed = text.trimStart();
          if (
            trimmed.startsWith('<!DOCTYPE') ||
            trimmed.startsWith('<html') ||
            trimmed.startsWith('import ') ||
            trimmed.startsWith('export ') ||
            trimmed.startsWith('module.exports')
          ) {
            return {
              ok: false,
              status: response.status,
              message:
                'Endpoint returned HTML or source code instead of JSON data. ' +
                'This usually indicates a backend deployment issue.',
              elapsed,
            };
          }

          // Try to parse as JSON anyway (some endpoints don't set content-type)
          try {
            const data = JSON.parse(text) as T;
            return { ok: true, status: response.status, data, headers: responseHeaders, elapsed };
          } catch {
            return { ok: true, status: response.status, data: text as unknown as T, headers: responseHeaders, elapsed };
          }
        }

        const data = (await response.json()) as T;
        return { ok: true, status: response.status, data, headers: responseHeaders, elapsed };
      } catch (err: unknown) {
        const elapsed = Date.now() - start;
        const message =
          err instanceof Error ? err.message : 'Unknown error';

        // Retry on network errors (timeout, ECONNRESET, etc.)
        if (attempt < MAX_RETRIES) {
          lastError = { ok: false, status: 0, message, elapsed };
          continue;
        }

        return { ok: false, status: 0, message, elapsed };
      }
    }

    // Should not reach here, but return last error if it does
    return lastError ?? { ok: false, status: 0, message: 'Unknown error after retries', elapsed: 0 };
  }
}
