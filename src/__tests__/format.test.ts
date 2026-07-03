import { describe, it, expect } from 'vitest';
import { compactJson, rankAndTruncate, summarize } from '../format.js';

describe('compactJson', () => {
  it('produces no pretty-printing', () => {
    const s = compactJson({ a: 1, b: [1, 2] });
    expect(s).not.toMatch(/\n/);
    expect(s).toBe('{"a":1,"b":[1,2]}');
  });
});

describe('rankAndTruncate', () => {
  const items = [{ s: 3 }, { s: 9 }, { s: 1 }, { s: 7 }, { s: 5 }];

  it('keeps the highest-scoring items, best first', () => {
    const r = rankAndTruncate(items, (x) => x.s, 3, 100_000);
    expect(r.kept.map((x) => x.s)).toEqual([9, 7, 5]);
    expect(r.dropped).toBe(2);
    expect(r.truncated).toBe(true);
  });

  it('respects maxChars by shedding lowest-scoring kept rows', () => {
    const big = Array.from({ length: 50 }, (_, i) => ({ s: i, pad: 'x'.repeat(100) }));
    const r = rankAndTruncate(big, (x) => x.s, 50, 500);
    expect(JSON.stringify(r.kept).length).toBeLessThanOrEqual(500);
    expect(r.kept[0].s).toBe(49); // top score survives
  });

  it('reports not truncated when everything fits', () => {
    const r = rankAndTruncate(items, (x) => x.s, 10, 100_000);
    expect(r.truncated).toBe(false);
    expect(r.dropped).toBe(0);
  });
});

describe('summarize', () => {
  const obj = { summary: { x: 1 }, rows: [1, 2, 3, 4, 5], scalar: 'k' };

  it('full is identity', () => {
    expect(summarize(obj, 'full')).toBe(obj);
  });

  it('compact collapses arrays to count + sample', () => {
    const out = summarize(obj, 'compact') as Record<string, unknown>;
    expect(out.rows).toEqual({ count: 5, sample: [1, 2, 3] });
    expect(out.scalar).toBe('k');
  });

  it('headline returns the summary block', () => {
    expect(summarize(obj, 'headline')).toEqual({ x: 1 });
  });
});
