/**
 * MCP Prompts — canned multi-tool workflows referencing the composite tools.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'morning_brief',
    {
      title: 'Morning trading brief',
      description: 'Pull macro + convergence + energy risk and summarize the day setup.',
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              'Produce my morning trading brief. Call get_macro_signals, scan_convergence ' +
              '(min_score 50), and get_energy_risk, then synthesize: market regime, the top ' +
              'convergence signals (with their aligned signal families), and energy/geopolitical ' +
              'risk with directional crude bias. Cite which tool each claim came from and flag ' +
              'low-confidence/low-coverage scores. Keep it concise. This is informational, not advice.',
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'pre_earnings_check',
    {
      title: 'Pre-earnings check',
      description: 'Run the pre-earnings checklist for a symbol.',
      argsSchema: { symbol: z.string().describe('Ticker, e.g. NVDA') },
    },
    ({ symbol }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Pre-earnings check for ${symbol}. Call get_ticker_intel (symbol ${symbol}, ` +
              `verbosity full), get_earnings_calendar, and get_options_flow (symbol ${symbol}). ` +
              `Summarize: days to earnings, options positioning (put/call, turnover), parsed ` +
              `insider activity, social buzz, and any congressional trades. Call out the ` +
              `coverage/confidence and what's missing. Informational, not advice.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'ticker_deep_dive',
    {
      title: 'Ticker deep dive',
      description: 'Full multi-source dossier on one symbol.',
      argsSchema: { symbol: z.string().describe('Ticker, e.g. AAPL') },
    },
    ({ symbol }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Deep dive on ${symbol}. Start with get_ticker_intel (verbosity full), then enrich ` +
              `with get_insider_activity, get_company_facts/get_company_filings, and ` +
              `get_institutional_holdings as relevant. Produce a structured dossier: ` +
              `positioning, flow, insider/institutional activity, fundamentals, catalysts, and a ` +
              `bull/bear synthesis. Distinguish facts from the model's inference. Not advice.`,
          },
        },
      ],
    }),
  );
}
