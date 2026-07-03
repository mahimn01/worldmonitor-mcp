import { describe, it, expect } from 'vitest';
import { occRight } from '../../handlers/sentiment.js';

describe('occRight (options put/call classification)', () => {
  it('reads the C/P flag at the fixed tail offset, not via includes()', () => {
    expect(occRight('AAPL260626C00110000')).toBe('C');
    // Regression: roots containing C or P must not be misclassified.
    expect(occRight('CRM260626P00250000')).toBe('P'); // root has C, flag is P
    expect(occRight('PYPL260626C00060000')).toBe('C'); // root has P, flag is C
    expect(occRight('PLTR260626P00030000')).toBe('P');
  });

  it('returns null for malformed/empty symbols', () => {
    expect(occRight(undefined)).toBeNull();
    expect(occRight('short')).toBeNull();
    expect(occRight('')).toBeNull();
  });
});
