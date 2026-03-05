/**
 * World Monitor MCP Server — exposes 107 intelligence tools via the
 * Model Context Protocol for use with Claude Code and other AI assistants.
 *
 * Enterprise features:
 * - Response truncation for oversized outputs (prevents context overflow)
 * - Known-broken endpoint detection with helpful alternatives
 * - Retry with backoff (via WorldMonitorClient)
 * - Response validation (detects HTML/source-code responses)
 *
 * Start via:
 *   npx worldmonitor-mcp              (standalone)
 *   worldmonitor --mcp                (from CLI)
 *
 * Configure in Claude Code:
 *   claude mcp add worldmonitor -- npx worldmonitor-mcp
 */

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadConfig } from './config.js';
import { WorldMonitorClient } from './client.js';
import { allServices } from './services/index.js';
import { ClientConfig, ParamDef } from './types.js';
import { directHandlers } from './handlers/index.js';

// ---------------------------------------------------------------------------
// Response size limit (100KB default — prevents context window overflow)
// ---------------------------------------------------------------------------

const MAX_RESPONSE_CHARS = parseInt(
  process.env.WORLDMONITOR_MAX_RESPONSE_SIZE ?? '100000',
  10,
);

/**
 * Truncate oversized JSON responses to prevent context window overflow.
 * Tries to truncate intelligently by reducing array sizes.
 */
function truncateResponse(json: string, toolName: string): string {
  if (json.length <= MAX_RESPONSE_CHARS) return json;

  const totalSize = json.length;

  // Try to parse and reduce arrays to fit
  try {
    const data = JSON.parse(json);

    // Find the largest array in the top-level object and truncate it
    if (typeof data === 'object' && data !== null) {
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key]) && data[key].length > 10) {
          // Progressively reduce until it fits
          while (data[key].length > 5) {
            data[key] = data[key].slice(0, Math.ceil(data[key].length / 2));
            const attempt = JSON.stringify(data, null, 2);
            if (attempt.length <= MAX_RESPONSE_CHARS) {
              data._truncated = {
                original_size: totalSize,
                original_items: json.split('\n').length,
                note: `Response truncated from ${Math.round(totalSize / 1024)}KB to fit context window. Use more specific parameters to reduce response size.`,
              };
              return JSON.stringify(data, null, 2);
            }
          }
        }
      }
    }
  } catch {
    // Not valid JSON — truncate raw string
  }

  // Fallback: hard truncate
  return (
    json.slice(0, MAX_RESPONSE_CHARS) +
    `\n\n... [TRUNCATED — response was ${Math.round(totalSize / 1024)}KB, limit is ${Math.round(MAX_RESPONSE_CHARS / 1024)}KB. Use more specific parameters for ${toolName} to reduce size.]`
  );
}

// ---------------------------------------------------------------------------
// Known-broken proxy endpoints (detected via audit)
// ---------------------------------------------------------------------------

const KNOWN_BROKEN: Record<string, string> = {
  get_shipping_rates:
    'This endpoint is currently unavailable (404). ' +
    'For shipping/freight data, try get_commodity_quotes or search for "Baltic Dry Index" via list_market_quotes.',
  get_chokepoint_status:
    'This endpoint is currently unavailable (404). ' +
    'For maritime chokepoint intel, try list_navigational_warnings for NGA maritime advisories, ' +
    'or search_and_extract with query "Suez Canal Panama Canal shipping disruptions".',
  get_gps_jamming:
    'This endpoint is currently returning invalid data (deployment issue). ' +
    'For GPS/GNSS interference data, try search_gdelt_documents with query "GPS jamming spoofing" ' +
    'or list_navigational_warnings for related maritime warnings.',
};

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
      schema = z.string().describe(def.description);
  }

  if (!def.required) {
    schema = schema.optional();
  }

  return schema;
}

function buildInputSchema(
  params?: Record<string, ParamDef>,
): Record<string, z.ZodTypeAny> {
  if (!params) return {};

  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [name, def] of Object.entries(params)) {
    shape[name] = paramToZod(def);
  }
  return shape;
}

// ---------------------------------------------------------------------------
// MCP server setup
// ---------------------------------------------------------------------------

export async function startMcpServer(
  configOverride?: ClientConfig,
): Promise<void> {
  const config = configOverride ?? loadConfig();
  const client = new WorldMonitorClient(config);

  const server = new McpServer({
    name: 'worldmonitor',
    version: '1.0.0',
  });

  // Register every tool from every service
  let toolCount = 0;

  for (const service of allServices) {
    for (const tool of service.tools) {
      const fullEndpoint = service.basePath + tool.endpoint;
      const method = tool.method ?? 'GET';
      const inputSchema = buildInputSchema(tool.params);

      server.tool(
        tool.name,
        `[${service.name}] ${tool.description}`,
        inputSchema,
        async (args) => {
          // Check for known-broken endpoints first
          const brokenMsg = KNOWN_BROKEN[tool.name];
          if (brokenMsg) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    {
                      error: true,
                      status: 'endpoint_unavailable',
                      message: brokenMsg,
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }

          // Build params from args
          const params: Record<string, unknown> = {};
          if (tool.params) {
            for (const key of Object.keys(tool.params)) {
              const val = (args as Record<string, unknown>)[key];
              if (val !== undefined) {
                params[key] = val;
              }
            }
          }

          // Check for direct handler first (external API calls)
          const handler = directHandlers[tool.name];
          if (handler) {
            try {
              const data = await handler(params);
              const json = JSON.stringify(data, null, 2);
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: truncateResponse(json, tool.name),
                  },
                ],
              };
            } catch (err: unknown) {
              const message =
                err instanceof Error ? err.message : 'Unknown error';
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: JSON.stringify(
                      { error: true, message },
                      null,
                      2,
                    ),
                  },
                ],
                isError: true,
              };
            }
          }

          // Proxy through WorldMonitorClient (includes retry logic)
          const result = await client.call(
            fullEndpoint,
            Object.keys(params).length > 0 ? params : undefined,
            method,
          );

          if (!result.ok) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    {
                      error: true,
                      status: result.status,
                      message: (result as { message: string }).message,
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }

          const json = JSON.stringify(result.data, null, 2);
          return {
            content: [
              {
                type: 'text' as const,
                text: truncateResponse(json, tool.name),
              },
            ],
          };
        },
      );

      toolCount++;
    }
  }

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with stdio MCP protocol
  console.error(
    `World Monitor MCP server started — ${toolCount} tools registered`,
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
