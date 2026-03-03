/**
 * World Monitor MCP Server — exposes 80+ intelligence tools via the
 * Model Context Protocol for use with Claude Code and other AI assistants.
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
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: JSON.stringify(data, null, 2),
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

          // Proxy through WorldMonitorClient
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

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result.data, null, 2),
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
