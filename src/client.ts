/**
 * HTTP client for the World Monitor API.
 *
 * Supports both proto-style endpoints (/api/{service}/v1/{rpc}) and legacy
 * endpoints (/api/{name}).  Returns structured ApiResponse objects.
 */

import { ClientConfig, ApiResponse, ApiError } from './types.js';

export class WorldMonitorClient {
  private config: ClientConfig;

  constructor(config: ClientConfig) {
    this.config = config;
  }

  /**
   * Call an API endpoint.
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
        return {
          ok: false,
          status: response.status,
          message: text || response.statusText,
          elapsed,
        };
      }

      const contentType = response.headers.get('content-type') ?? '';
      let data: T;

      if (contentType.includes('application/json')) {
        data = (await response.json()) as T;
      } else {
        data = (await response.text()) as unknown as T;
      }

      return { ok: true, status: response.status, data, headers: responseHeaders, elapsed };
    } catch (err: unknown) {
      const elapsed = Date.now() - start;
      const message =
        err instanceof Error ? err.message : 'Unknown error';
      return { ok: false, status: 0, message, elapsed };
    }
  }
}
