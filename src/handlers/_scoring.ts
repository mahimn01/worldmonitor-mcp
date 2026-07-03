/**
 * Transparent scoring primitives for the composite trading tools.
 *
 * Design rules (honesty over false precision):
 *  - Every score ships with a `factors[]` breakdown and a `confidence` derived
 *    from feed coverage. A missing feed neither helps nor hurts — weights
 *    renormalize over only the feeds that succeeded.
 *  - Factor labels name the data for what it IS ("options P/C ratio (delayed)",
 *    "social buzz volume") — never imputed direction the feed can't supply.
 *  - WEIGHTS are exported and documented so they can be tuned.
 */

export const WEIGHTS = {
  ticker: {
    price_momentum: 0.2, // intraday % change (directional)
    options_pc: 0.25, // CBOE put/call volume ratio (directional) + turnover (intensity)
    insider_net: 0.25, // net open-market $ from parsed Form 4 (directional)
    congress_net: 0.1, // net congressional buys−sells for the ticker (directional)
    social_buzz: 0.15, // r/wallstreetbets engagement (magnitude only, no direction)
    earnings_catalyst: 0.05, // proximity to next earnings (magnitude only)
  },
  energy: {
    price_momentum: 0.25,
    chokepoint_warn: 0.2,
    theater_posture: 0.2,
    gdelt_tone: 0.15,
    tanker_activity: 0.1,
    acled_events: 0.1,
  },
} as const;

export const BUZZ_INTENSITY: Record<string, number> = {
  low: 0.2,
  moderate: 0.5,
  high: 0.75,
  very_high: 1.0,
};

/**
 * Log-scale a dollar amount into [0,1] intensity: $100k → 0, $100M → 1.
 * A linear /1e6 clamp would saturate at $1M and make every mega-cap's routine
 * flow read as maximal — log spacing keeps $1M / $10M / $100M distinguishable
 * (≈0.33 / 0.67 / 1.0).
 */
export function usdIntensity(usd: number): number {
  const abs = Math.abs(usd);
  if (abs < 100_000) return 0;
  return clamp((Math.log10(abs) - 5) / 3, 0, 1);
}

/**
 * Insider SELLS are discounted vs buys: scheduled 10b5-1 selling and
 * diversification are routine, while open-market BUYS are rare, personal-cash
 * conviction. Tunable.
 */
export const INSIDER_SELL_DISCOUNT = 0.5;

export interface Factor {
  key: string;
  label: string;
  signal: number; // -1 bearish … +1 bullish (0 = neutral / magnitude-only)
  intensity: number; // 0 … 1
  weight: number;
  contribution: number; // weight × intensity (magnitude contribution)
}

export const clamp = (x: number, lo = -1, hi = 1): number =>
  Math.max(lo, Math.min(hi, x));

export function makeFactor(
  key: string,
  label: string,
  signal: number,
  intensity: number,
  weight: number,
): Factor {
  const i = clamp(intensity, 0, 1);
  // Contribution is derived from the ROUNDED intensity so the displayed
  // fields are internally consistent (weight × intensity == contribution
  // when recomputed from the output itself).
  const rounded = Math.round(i * 100) / 100;
  return {
    key,
    label,
    signal: clamp(signal),
    intensity: rounded,
    weight,
    contribution: Math.round(weight * rounded * 100) / 100,
  };
}

export interface Aggregate {
  score: number | null; // 0-100 magnitude; null when confidence too low
  direction: 'bullish' | 'bearish' | 'neutral' | 'insufficient_data';
  direction_score: number; // -100 … 100
  confidence: number; // 0 … 1 (share of total weight that had data)
}

const MIN_CONFIDENCE = 0.4;

/**
 * Combine factors → magnitude score + directional read, renormalized over only
 * the weight that actually had data. `totalWeight` is the sum of ALL possible
 * factor weights (present or not) so confidence reflects true coverage.
 *
 * Coverage semantics: callers emit ZERO-intensity factors for feeds that
 * succeeded but showed no notable activity ("covered but quiet") — those count
 * toward confidence and dilute magnitude, so a boring-but-fully-covered ticker
 * scores LOW with HIGH confidence instead of having its score withheld.
 * Only genuinely failed/unusable feeds omit their factor.
 *
 * When the score is withheld (confidence < MIN_CONFIDENCE), the directional
 * read is withheld too — a direction without a score is still a claim.
 */
export function aggregate(factors: Factor[], totalWeight: number): Aggregate {
  const presentWeight = factors.reduce((s, f) => s + f.weight, 0);
  const confidence =
    totalWeight > 0 ? Math.round((presentWeight / totalWeight) * 100) / 100 : 0;
  if (presentWeight === 0 || confidence < MIN_CONFIDENCE) {
    return {
      score: null,
      direction: 'insufficient_data',
      direction_score: 0,
      confidence,
    };
  }
  const magnitude =
    factors.reduce((s, f) => s + f.weight * f.intensity, 0) / presentWeight;
  const dir =
    factors.reduce((s, f) => s + f.weight * f.intensity * f.signal, 0) /
    presentWeight;
  const direction: Aggregate['direction'] =
    dir > 0.15 ? 'bullish' : dir < -0.15 ? 'bearish' : 'neutral';
  return {
    score: Math.round(magnitude * 100),
    direction,
    direction_score: Math.round(dir * 100),
    confidence,
  };
}

export const DISCLAIMER =
  'Informational only — NOT investment advice and NOT a trade signal. ' +
  'Scores fuse heterogeneous free/delayed data; always check the factor breakdown and coverage.';
