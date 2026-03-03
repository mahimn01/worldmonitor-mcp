/**
 * Output formatting for CLI responses.
 */

import { OutputFormat, ApiResponse, ApiError } from './types.js';

export function formatOutput(
  result: ApiResponse | ApiError,
  format: OutputFormat,
): string {
  if (!result.ok) {
    const err = result as ApiError;
    return JSON.stringify(
      { error: true, status: err.status, message: err.message, elapsed: err.elapsed },
      null,
      format === 'json-pretty' ? 2 : undefined,
    );
  }

  const res = result as ApiResponse;

  switch (format) {
    case 'json':
      return JSON.stringify(res.data);
    case 'json-pretty':
      return JSON.stringify(res.data, null, 2);
    case 'raw':
      return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    default:
      return JSON.stringify(res.data, null, 2);
  }
}
