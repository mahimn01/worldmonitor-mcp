/**
 * Tests for the WorldMonitorClient HTTP client.
 * Uses mock fetch to verify request construction and response handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorldMonitorClient } from '../client.js';

// Mock global fetch
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, status = 200): Response {
  const headers = new Headers({ 'content-type': 'application/json' });
  return new Response(JSON.stringify(data), { status, headers });
}

function textResponse(text: string, status = 200): Response {
  const headers = new Headers({ 'content-type': 'text/plain' });
  return new Response(text, { status, headers });
}

describe('WorldMonitorClient', () => {
  const config = {
    baseUrl: 'https://test.worldmonitor.app',
    timeout: 5000,
  };

  it('should make GET requests with query params', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ earthquakes: [{ mag: 5.2 }] }),
    );

    const client = new WorldMonitorClient(config);
    const result = await client.call('/api/seismology/v1/list-earthquakes', {
      min_magnitude: 5,
      cursor: 'abc',
    });

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('min_magnitude=5');
    expect(calledUrl).toContain('cursor=abc');
    expect(calledUrl).toContain(
      'https://test.worldmonitor.app/api/seismology/v1/list-earthquakes',
    );

    const calledOpts = mockFetch.mock.calls[0][1] as RequestInit;
    expect(calledOpts.method).toBe('GET');
  });

  it('should make POST requests with JSON body', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ summary: 'test summary' }),
    );

    const client = new WorldMonitorClient(config);
    const result = await client.call(
      '/api/news/v1/summarize-article',
      { provider: 'groq', headlines: ['test headline'] },
      'POST',
    );

    expect(result.ok).toBe(true);
    const calledOpts = mockFetch.mock.calls[0][1] as RequestInit;
    expect(calledOpts.method).toBe('POST');
    expect(calledOpts.headers).toHaveProperty(
      'Content-Type',
      'application/json',
    );
    expect(calledOpts.body).toBe(
      JSON.stringify({ provider: 'groq', headlines: ['test headline'] }),
    );
  });

  it('should include Authorization header when apiKey is set', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const client = new WorldMonitorClient({
      ...config,
      apiKey: 'test-key-123',
    });
    await client.call('/api/test');

    const calledOpts = mockFetch.mock.calls[0][1] as RequestInit;
    expect((calledOpts.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer test-key-123',
    );
  });

  it('should omit Authorization header when apiKey is not set', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const client = new WorldMonitorClient(config);
    await client.call('/api/test');

    const calledOpts = mockFetch.mock.calls[0][1] as RequestInit;
    expect(
      (calledOpts.headers as Record<string, string>)['Authorization'],
    ).toBeUndefined();
  });

  it('should handle HTTP error responses', async () => {
    // Client retries 429s — provide enough mock responses for all attempts
    mockFetch
      .mockResolvedValueOnce(new Response('Rate limit exceeded', { status: 429 }))
      .mockResolvedValueOnce(new Response('Rate limit exceeded', { status: 429 }))
      .mockResolvedValueOnce(new Response('Rate limit exceeded', { status: 429 }));

    const client = new WorldMonitorClient(config);
    const result = await client.call('/api/test');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(429);
    if (!result.ok) {
      expect((result as { message: string }).message).toBe('Rate limit exceeded');
    }
    // Should have retried (1 initial + 2 retries = 3 total)
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should handle non-retryable HTTP errors without retrying', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Not Found', { status: 404 }),
    );

    const client = new WorldMonitorClient(config);
    const result = await client.call('/api/test');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    // 404 is not retryable — should only call fetch once
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should handle network errors', async () => {
    // Client retries network errors — provide enough mock rejections
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'));

    const client = new WorldMonitorClient(config);
    const result = await client.call('/api/test');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    if (!result.ok) {
      expect((result as { message: string }).message).toBe('Network error');
    }
  });

  it('should recover on retry after transient failure', async () => {
    // First attempt fails with 503, second succeeds
    mockFetch
      .mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ recovered: true }));

    const client = new WorldMonitorClient(config);
    const result = await client.call('/api/test');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ recovered: true });
    }
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should handle text responses', async () => {
    mockFetch.mockResolvedValueOnce(textResponse('<rss>...</rss>'));

    const client = new WorldMonitorClient(config);
    const result = await client.call('/api/rss-proxy');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe('<rss>...</rss>');
    }
  });

  it('should skip undefined and null params', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));

    const client = new WorldMonitorClient(config);
    await client.call('/api/test', {
      a: 'keep',
      b: undefined,
      c: null,
      d: '',
    });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('a=keep');
    expect(calledUrl).not.toContain('b=');
    expect(calledUrl).not.toContain('c=');
    expect(calledUrl).not.toContain('d=');
  });

  it('should handle array params by joining with commas', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));

    const client = new WorldMonitorClient(config);
    await client.call('/api/test', {
      symbols: ['AAPL', 'MSFT', 'GOOG'],
    });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('symbols=AAPL%2CMSFT%2CGOOG');
  });

  it('should track elapsed time', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));

    const client = new WorldMonitorClient(config);
    const result = await client.call('/api/test');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.elapsed).toBe('number');
      expect(result.elapsed).toBeGreaterThanOrEqual(0);
    }
  });

  it('should include response headers', async () => {
    const headers = new Headers({
      'content-type': 'application/json',
      'x-cache': 'HIT',
    });
    mockFetch.mockResolvedValueOnce(
      new Response('{}', { status: 200, headers }),
    );

    const client = new WorldMonitorClient(config);
    const result = await client.call('/api/test');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.headers['x-cache']).toBe('HIT');
    }
  });
});
