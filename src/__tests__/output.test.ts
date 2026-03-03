/**
 * Tests for output formatting.
 */

import { describe, it, expect } from 'vitest';
import { formatOutput } from '../output.js';
import { ApiResponse, ApiError } from '../types.js';

describe('formatOutput', () => {
  const successResult: ApiResponse = {
    ok: true,
    status: 200,
    data: { earthquakes: [{ mag: 5.2, place: 'Tokyo' }] },
    headers: {},
    elapsed: 123,
  };

  const errorResult: ApiError = {
    ok: false,
    status: 429,
    message: 'Rate limit exceeded',
    elapsed: 50,
  };

  it('should format success as compact JSON', () => {
    const output = formatOutput(successResult, 'json');
    expect(output).toBe(
      '{"earthquakes":[{"mag":5.2,"place":"Tokyo"}]}',
    );
  });

  it('should format success as pretty JSON', () => {
    const output = formatOutput(successResult, 'json-pretty');
    const parsed = JSON.parse(output);
    expect(parsed.earthquakes[0].mag).toBe(5.2);
    expect(output).toContain('\n'); // Pretty printed
  });

  it('should format success as raw', () => {
    const output = formatOutput(successResult, 'raw');
    // Raw mode on an object falls back to JSON
    const parsed = JSON.parse(output);
    expect(parsed.earthquakes).toBeDefined();
  });

  it('should format raw strings directly', () => {
    const strResult: ApiResponse = {
      ok: true,
      status: 200,
      data: '<rss>test</rss>',
      headers: {},
      elapsed: 10,
    };
    const output = formatOutput(strResult, 'raw');
    expect(output).toBe('<rss>test</rss>');
  });

  it('should format errors with status and message', () => {
    const output = formatOutput(errorResult, 'json-pretty');
    const parsed = JSON.parse(output);
    expect(parsed.error).toBe(true);
    expect(parsed.status).toBe(429);
    expect(parsed.message).toBe('Rate limit exceeded');
  });

  it('should include elapsed time in error output', () => {
    const output = formatOutput(errorResult, 'json');
    const parsed = JSON.parse(output);
    expect(parsed.elapsed).toBe(50);
  });
});
