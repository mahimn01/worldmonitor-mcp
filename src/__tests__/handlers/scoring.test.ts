import { describe, it, expect } from 'vitest';
import { makeFactor, aggregate, clamp, Factor } from '../../handlers/_scoring.js';

describe('clamp', () => {
  it('bounds to [-1,1] by default', () => {
    expect(clamp(5)).toBe(1);
    expect(clamp(-5)).toBe(-1);
    expect(clamp(0.3)).toBe(0.3);
  });
});

describe('makeFactor', () => {
  it('clamps signal/intensity and computes contribution', () => {
    const f = makeFactor('k', 'label', 2, 1.5, 0.2);
    expect(f.signal).toBe(1);
    expect(f.intensity).toBe(1);
    expect(f.contribution).toBe(0.2);
  });
});

describe('aggregate', () => {
  const totalWeight = 1.0;

  it('confidence reflects share of total weight present', () => {
    const factors: Factor[] = [makeFactor('a', 'a', 1, 1, 0.5)];
    const agg = aggregate(factors, totalWeight);
    expect(agg.confidence).toBe(0.5);
  });

  it('withholds the score AND direction when confidence is below the floor', () => {
    const factors: Factor[] = [makeFactor('a', 'a', 1, 1, 0.3)];
    const agg = aggregate(factors, totalWeight);
    expect(agg.confidence).toBe(0.3);
    expect(agg.score).toBeNull(); // < 0.4 floor
    // A direction without a score is still a claim — withheld together.
    expect(agg.direction).toBe('insufficient_data');
    expect(agg.direction_score).toBe(0);
  });

  it('zero-intensity (covered-but-quiet) factors add confidence without direction', () => {
    const factors: Factor[] = [
      makeFactor('active', 'active', 1, 1, 0.5),
      makeFactor('quiet', 'quiet feed, no activity', 0, 0, 0.5),
    ];
    const agg = aggregate(factors, totalWeight);
    expect(agg.confidence).toBe(1); // quiet feed still counts as covered
    expect(agg.score).toBe(50); // magnitude diluted by the quiet feed
    expect(agg.direction).toBe('bullish');
  });

  it('emits a score and bullish direction with enough coverage', () => {
    const factors: Factor[] = [
      makeFactor('a', 'a', 1, 1, 0.5),
      makeFactor('b', 'b', 1, 1, 0.5),
    ];
    const agg = aggregate(factors, totalWeight);
    expect(agg.confidence).toBe(1);
    expect(agg.score).toBe(100);
    expect(agg.direction).toBe('bullish');
  });

  it('nets opposing signals toward neutral', () => {
    const factors: Factor[] = [
      makeFactor('a', 'a', 1, 1, 0.5),
      makeFactor('b', 'b', -1, 1, 0.5),
    ];
    const agg = aggregate(factors, totalWeight);
    expect(agg.direction).toBe('neutral');
    expect(agg.direction_score).toBe(0);
  });

  it('returns null score and insufficient_data when no factors present', () => {
    const agg = aggregate([], totalWeight);
    expect(agg.score).toBeNull();
    expect(agg.confidence).toBe(0);
    expect(agg.direction).toBe('insufficient_data');
  });
});
