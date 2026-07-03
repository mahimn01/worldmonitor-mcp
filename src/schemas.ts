/**
 * Zod output schemas (ZodRawShape) for the composite tools registered via
 * server.registerTool. They mirror the handlers' top-level return keys and stay
 * permissive (z.any() for nested detail, .nullable where a score may be withheld)
 * so partial-coverage results still validate as structuredContent.
 */

import { z } from 'zod';

const factor = z.object({
  key: z.string(),
  label: z.string(),
  signal: z.number(),
  intensity: z.number(),
  weight: z.number(),
  contribution: z.number(),
});

const coverage = z.array(
  z.object({ name: z.string(), ok: z.boolean(), error: z.string().optional() }),
);

export const tickerIntelShape = {
  symbol: z.string(),
  generated_at: z.string(),
  conviction_score: z.number().nullable(),
  direction: z.string(),
  direction_score: z.number(),
  confidence: z.number(),
  factors: z.array(factor),
  coverage,
  disclaimer: z.string(),
  components: z.any().optional(),
} as const;

export const convergenceShape = {
  generated_at: z.string(),
  universe_source: z.string(),
  candidate_count: z.number(),
  min_score: z.number(),
  results: z.array(
    z.object({
      symbol: z.string(),
      convergence_score: z.number(),
      net_direction: z.string(),
      aligned_count: z.number(),
      conflicted: z.boolean(),
      votes: z.record(z.string(), z.number()),
      factors: z.array(factor).optional(),
    }),
  ),
  dropped: z.number(),
  truncated: z.boolean(),
  disclaimer: z.string(),
} as const;

export const energyRiskShape = {
  generated_at: z.string(),
  commodity: z.string(),
  energy_risk_score: z.number().nullable(),
  direction: z.string(),
  direction_score: z.number(),
  confidence: z.number(),
  factors: z.array(factor),
  coverage,
  disclaimer: z.string(),
  detail: z.any().optional(),
} as const;

export const changesSinceShape = {
  feed: z.string(),
  scope: z.string(),
  since: z.number(),
  as_of: z.number(),
  backend: z.string(),
  new_count: z.number(),
  changed_count: z.number(),
  changes: z.array(z.any()),
  changes_truncated: z.number().optional(),
  fetch_error: z.string().optional(),
  error: z.boolean().optional(),
  message: z.string().optional(),
} as const;

export const OUTPUT_SCHEMAS: Record<string, z.ZodRawShape> = {
  get_ticker_intel: tickerIntelShape,
  scan_convergence: convergenceShape,
  get_energy_risk: energyRiskShape,
  get_changes_since: changesSinceShape,
};
