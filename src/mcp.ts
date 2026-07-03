/**
 * World Monitor MCP Server — exposes intelligence + composite trading tools via
 * the Model Context Protocol.
 *
 * Features:
 * - Composite trading tools (scored, with factor breakdown + coverage/confidence)
 * - SQLite-or-memory cache + snapshot store (change-detection)
 * - registerTool with read-only annotations; structuredContent for composites
 * - Compact serialization + final-safety-net truncation
 * - Known-broken endpoint detection, retry/backoff (via WorldMonitorClient)
 *
 * Start via:
 *   npx worldmonitor-mcp              (standalone)
 *   worldmonitor --mcp                (from CLI)
 */

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadConfig, envInt } from './config.js';
import { allServices } from './services/index.js';
import { ClientConfig, ParamDef, ApiError, ApiResponse } from './types.js';
import { directHandlers } from './handlers/index.js';
import { createContext } from './handlers/_invoke.js';
import { openStore } from './store.js';
import { KNOWN_BROKEN } from './known-broken.js';
import { OUTPUT_SCHEMAS } from './schemas.js';
import { compactJson } from './format.js';
import { registerResources } from './resources.js';
import { registerPrompts } from './prompts.js';

// ---------------------------------------------------------------------------
// Response size limit (100KB default — prevents context window overflow)
// ---------------------------------------------------------------------------

// envInt treats ''/garbage as unset — a bare WORLDMONITOR_MAX_RESPONSE_SIZE=
// line in .env would otherwise parse to NaN and blank every response.
const MAX_RESPONSE_CHARS = envInt('WORLDMONITOR_MAX_RESPONSE_SIZE') ?? 100_000;

/** Final-safety-net truncation. Emits compact JSON; trims largest array if oversized. */
function truncateResponse(json: string, toolName: string): string {
  if (json.length <= MAX_RESPONSE_CHARS) return json;
  const totalSize = json.length;
  try {
    const data = JSON.parse(json);
    if (typeof data === 'object' && data !== null) {
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key]) && data[key].length > 10) {
          while (data[key].length > 5) {
            data[key] = data[key].slice(0, Math.ceil(data[key].length / 2));
            const attempt = compactJson(data);
            if (attempt.length <= MAX_RESPONSE_CHARS) {
              data._truncated = {
                original_size: totalSize,
                note: `Response truncated from ${Math.round(totalSize / 1024)}KB to fit the context window. Use more specific parameters to reduce size.`,
              };
              return compactJson(data);
            }
          }
        }
      }
    }
  } catch {
    // Not valid JSON — fall through to hard truncate.
  }
  return (
    json.slice(0, MAX_RESPONSE_CHARS) +
    `\n\n... [TRUNCATED — response was ${Math.round(totalSize / 1024)}KB, limit ${Math.round(MAX_RESPONSE_CHARS / 1024)}KB. Use more specific parameters for ${toolName}.]`
  );
}

// ---------------------------------------------------------------------------
// Zod schema generation from ParamDef
// ---------------------------------------------------------------------------

function paramToZod(def: ParamDef): z.ZodTypeAny {
  let schema: z.ZodTypeAny;
  switch (def.type) {
    case 'number':
      schema = z.number().describe(def.description);
      break;
    case 'boolean':
      schema = z.boolean().describe(def.description);
      break;
    case 'string[]':
      schema = z.array(z.string()).describe(def.description);
      break;
    default:
      // Declared enums reach the advertised inputSchema instead of being
      // silently widened to plain strings.
      schema =
        def.enum && def.enum.length
          ? z.enum(def.enum as [string, ...string[]]).describe(def.description)
          : z.string().describe(def.description);
  }
  if (def.default !== undefined) {
    schema = schema.default(def.default);
  } else if (!def.required) {
    schema = schema.optional();
  }
  return schema;
}

function buildInputSchema(
  params?: Record<string, ParamDef>,
): Record<string, z.ZodTypeAny> {
  if (!params) return {};
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [name, def] of Object.entries(params)) shape[name] = paramToZod(def);
  return shape;
}

function buildParams(
  args: Record<string, unknown>,
  params?: Record<string, ParamDef>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!params) return out;
  for (const key of Object.keys(params)) {
    const val = args[key];
    if (val !== undefined) out[key] = val;
  }
  return out;
}

const errorResult = (payload: Record<string, unknown>) => ({
  content: [{ type: 'text' as const, text: compactJson(payload) }],
  isError: true as const,
});

// ---------------------------------------------------------------------------
// MCP server setup
// ---------------------------------------------------------------------------

export async function startMcpServer(
  configOverride?: ClientConfig,
): Promise<void> {
  const config = configOverride ?? loadConfig();
  const store = openStore(config.dataDir);
  store.pruneExpired();
  const ctx = createContext(store, config);

  const server = new McpServer({ name: 'worldmonitor', version: '1.0.0' });

  // Tools that mutate server-side state — everything else is read-only.
  const MUTATING_TOOLS = new Set(['record_baseline_snapshot']);

  let toolCount = 0;
  for (const service of allServices) {
    for (const tool of service.tools) {
      const fullEndpoint = service.basePath + tool.endpoint;
      const method = tool.method ?? 'GET';
      const inputSchema = buildInputSchema(tool.params);
      const outputSchema = OUTPUT_SCHEMAS[tool.name];

      server.registerTool(
        tool.name,
        {
          description: `[${service.name}] ${tool.description}`,
          inputSchema,
          annotations: {
            title: tool.name,
            readOnlyHint: !MUTATING_TOOLS.has(tool.name),
            openWorldHint: true,
          },
          ...(outputSchema ? { outputSchema } : {}),
        },
        async (args: Record<string, unknown>) => {
          const broken = KNOWN_BROKEN[tool.name];
          if (broken) {
            return errorResult({
              error: true,
              status: 'endpoint_unavailable',
              message: broken,
            });
          }
          const params = buildParams(args, tool.params);
          try {
            let data: unknown;
            const direct = directHandlers[tool.name];
            if (direct) {
              data = await direct(params, ctx);
            } else {
              const res = await ctx.client.call(
                fullEndpoint,
                Object.keys(params).length > 0 ? params : undefined,
                method,
              );
              if (!res.ok) {
                return errorResult({
                  error: true,
                  status: res.status,
                  message: (res as ApiError).message,
                });
              }
              data = (res as ApiResponse).data;
            }
            const text = truncateResponse(compactJson(data), tool.name);
            // error→isError mapping applies ONLY to composite tools that
            // declare an outputSchema. Several legacy handlers legitimately
            // return informational {error: ...} fallbacks that must not flip
            // their MCP result to isError (pre-existing behavior).
            const isErr =
              Boolean(outputSchema) &&
              data !== null &&
              typeof data === 'object' &&
              (data as { error?: unknown }).error === true;
            if (isErr) {
              return { content: [{ type: 'text' as const, text }], isError: true };
            }
            if (!outputSchema) {
              return { content: [{ type: 'text' as const, text }] };
            }
            // structuredContent must (a) conform to outputSchema — SDK
            // validates — and (b) respect the same size ceiling as the text
            // channel: parse the (possibly truncated) text so both views stay
            // consistent and bounded. Truncation only shortens arrays, so the
            // schema still validates; the extra _truncated marker passes
            // non-strict Zod objects.
            let outText = text;
            let structured: Record<string, unknown>;
            try {
              structured = JSON.parse(outText) as Record<string, unknown>;
            } catch {
              // Hard-truncate fallback (oversized NESTED payload, e.g.
              // verbosity=full components) leaves invalid-JSON text. Build a
              // bounded projection by stripping the bulk detail keys and use
              // it for BOTH channels so they stay consistent and valid.
              const projected = { ...(data as Record<string, unknown>) };
              delete projected.components;
              delete projected.detail;
              (projected as Record<string, unknown>)._truncated = {
                note: 'oversized payload: components/detail stripped to fit the response size limit',
              };
              outText = truncateResponse(compactJson(projected), tool.name);
              structured = projected;
            }
            return {
              content: [{ type: 'text' as const, text: outText }],
              structuredContent: structured,
            };
          } catch (err: unknown) {
            return errorResult({
              error: true,
              message: err instanceof Error ? err.message : 'Unknown error',
            });
          }
        },
      );
      toolCount++;
    }
  }

  registerResources(server, ctx, config);
  registerPrompts(server);

  // Periodic housekeeping — long-lived sessions (always-on monitors) would
  // otherwise only prune cache/history at startup. unref() so the timer never
  // keeps the process alive.
  const pruneTimer = setInterval(
    () => {
      try {
        store.pruneExpired();
      } catch {
        /* best-effort */
      }
    },
    6 * 60 * 60 * 1000,
  );
  pruneTimer.unref();

  // Lifecycle: flush the store on exit.
  const close = () => {
    try {
      store.close();
    } catch {
      /* ignore */
    }
  };
  process.once('SIGINT', () => {
    close();
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    close();
    process.exit(0);
  });
  process.once('beforeExit', close);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr — stdout carries the MCP JSON-RPC frames.
  console.error(
    `World Monitor MCP server started — ${toolCount} tools registered (store: ${store.backend})`,
  );
  console.error(`API target: ${config.baseUrl}`);
}

// When run directly (not imported)
const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('/mcp.js') ||
  process.argv[1]?.endsWith('/mcp.ts');

if (isMain) {
  startMcpServer().catch((err) => {
    console.error('Failed to start MCP server:', err);
    process.exit(1);
  });
}
