/**
 * MCP Resources — a configured watchlist and a composed daily brief.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClientConfig, ToolContext } from './types.js';
import { compactJson, summarize } from './format.js';

export function registerResources(
  server: McpServer,
  ctx: ToolContext,
  config: ClientConfig,
): void {
  server.registerResource(
    'watchlist',
    'watchlist://default',
    {
      title: 'Trading watchlist',
      description: 'User-configured symbols of interest (env/file/default).',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: compactJson({
            symbols: config.watchlist,
            source: config.watchlistSource,
          }),
        },
      ],
    }),
  );

  server.registerResource(
    'daily-brief',
    'brief://today',
    {
      title: "Today's market brief",
      description:
        'Macro signals + sector summary + top convergence (cached per WORLDMONITOR_CACHE_TTL, default 15m).',
      mimeType: 'application/json',
    },
    async (uri) => {
      const cacheKey = 'resource:brief:today';
      const hit = ctx.store.cacheGet(cacheKey);
      if (hit) {
        return {
          contents: [
            { uri: uri.href, mimeType: 'application/json', text: compactJson(hit.value) },
          ],
        };
      }
      const [macro, sectors, convergence] = await Promise.all([
        ctx.callTool('get_macro_signals').catch((e) => ({ error: String(e) })),
        ctx.callTool('get_sector_summary').catch((e) => ({ error: String(e) })),
        ctx.callTool('scan_convergence', { min_score: 50 }).catch((e) => ({ error: String(e) })),
      ]);
      const brief = {
        generated_at: new Date().toISOString(),
        // headline projection retains scalar fields (verdict, counts, error
        // messages) — failures surface as {error: "..."} instead of vanishing.
        macro: summarize(macro, 'headline'),
        sectors: summarize(sectors, 'compact'),
        convergence,
      };
      // Never pin an all-failed brief for the whole TTL — retry next read.
      const anySucceeded = [macro, sectors, convergence].some(
        (r) => !(r as Record<string, unknown>)?.error,
      );
      if (anySucceeded) {
        try {
          ctx.store.cacheSet(cacheKey, brief, config.cacheTtlSeconds);
        } catch {
          /* best-effort */
        }
      }
      return {
        contents: [
          { uri: uri.href, mimeType: 'application/json', text: compactJson(brief) },
        ],
      };
    },
  );
}
