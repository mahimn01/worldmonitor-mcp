/**
 * Output / token-efficiency helpers.
 *
 * `rankAndTruncate` replaces the lossy "halve the largest array" truncation
 * (which silently drops the most important rows) with rank-first: keep the
 * highest-scoring rows that fit the item and character budgets.
 */

/** Minified JSON — no pretty-printing. Use on hot paths instead of (x, null, 2). */
export function compactJson(obj: unknown): string {
  return JSON.stringify(obj);
}

export interface RankResult<T> {
  kept: T[];
  dropped: number;
  truncated: boolean;
}

/**
 * Keep the highest-scoring items that fit both `maxItems` and `maxChars`.
 * Ordering is best-first, so any later blind truncation still preserves signal.
 * Contract note: the final remaining item is always kept even if it alone
 * exceeds maxChars — returning nothing would drop all signal; the global
 * response truncator is the final safety net for that case.
 */
export function rankAndTruncate<T>(
  items: T[],
  scoreFn: (item: T) => number,
  maxItems: number,
  maxChars: number,
): RankResult<T> {
  const ranked = [...items].sort((a, b) => scoreFn(b) - scoreFn(a));
  let kept = ranked.slice(0, Math.max(0, maxItems));
  while (kept.length > 1 && JSON.stringify(kept).length > maxChars) {
    kept = kept.slice(0, -1); // shed the lowest-scoring kept item
  }
  return {
    kept,
    dropped: items.length - kept.length,
    truncated: kept.length < items.length,
  };
}

export type SummaryMode = 'full' | 'compact' | 'headline';

/**
 * Project an object down by verbosity:
 *  - full:     identity
 *  - compact:  replace arrays with { count, sample: first 3 }
 *  - headline: the summary/current block if present, else the scalar
 *              top-level fields (verdicts, counts, error messages) — never
 *              just a list of key names.
 */
export function summarize(obj: unknown, mode: SummaryMode = 'full'): unknown {
  if (mode === 'full' || obj === null || typeof obj !== 'object') return obj;
  const rec = obj as Record<string, unknown>;
  if (mode === 'headline') {
    if (rec.summary !== undefined) return rec.summary;
    if (rec.current !== undefined) return rec.current;
    // Fall back to the scalar fields — retains verdict/error/counts instead
    // of collapsing the payload to useless key names.
    const scalars: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) {
        scalars[k] = v;
      }
    }
    return Object.keys(scalars).length ? scalars : { keys: Object.keys(rec) };
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    out[k] = Array.isArray(v) ? { count: v.length, sample: v.slice(0, 3) } : v;
  }
  return out;
}
