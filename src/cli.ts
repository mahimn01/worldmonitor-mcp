#!/usr/bin/env node
/**
 * World Monitor CLI — access 80+ intelligence data tools from the command line.
 *
 * Usage:
 *   worldmonitor military flights --ne_lat=50 --sw_lat=40
 *   worldmonitor market quotes --symbols=AAPL,MSFT
 *   worldmonitor seismology earthquakes --min_magnitude=5
 *   worldmonitor --list-tools
 *   worldmonitor --mcp   (starts MCP server over stdio)
 */

import { Command } from 'commander';
import { loadConfig } from './config.js';
import { WorldMonitorClient } from './client.js';
import { formatOutput } from './output.js';
import { allServices, allTools } from './services/index.js';
import { OutputFormat, ServiceDef, ToolDef } from './types.js';
import { directHandlers } from './handlers/index.js';

// ---------------------------------------------------------------------------
// Handle special flags BEFORE commander parses (they don't need subcommands)
// ---------------------------------------------------------------------------

async function handleSpecialFlags(): Promise<boolean> {
  const args = process.argv.slice(2);

  if (args.includes('--list-tools')) {
    printToolList();
    return true;
  }

  if (args.includes('--mcp')) {
    const { startMcpServer } = await import('./mcp.js');

    // Extract config overrides from args
    const baseUrlIdx = args.indexOf('--base-url');
    const apiKeyIdx = args.indexOf('--api-key');
    const timeoutIdx = args.indexOf('--timeout');

    await startMcpServer(
      loadConfig({
        baseUrl: baseUrlIdx >= 0 ? args[baseUrlIdx + 1] : undefined,
        apiKey: apiKeyIdx >= 0 ? args[apiKeyIdx + 1] : undefined,
        timeout: timeoutIdx >= 0 ? parseInt(args[timeoutIdx + 1], 10) : undefined,
      }),
    );
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// --list-tools
// ---------------------------------------------------------------------------

function printToolList(): void {
  const tools = allTools();
  const byService: Record<string, typeof tools> = {};
  for (const t of tools) {
    (byService[t.service] ??= []).push(t);
  }

  console.log(
    `\nWorld Monitor CLI — ${tools.length} tools across ${Object.keys(byService).length} services\n`,
  );

  for (const [svc, svcTools] of Object.entries(byService)) {
    console.log(`  ${svc}`);
    for (const t of svcTools) {
      const params = t.params
        ? Object.keys(t.params)
            .map((p) => (t.params![p].required ? `<${p}>` : `[${p}]`))
            .join(' ')
        : '';
      console.log(`    ${t.name}  ${params}`);
    }
    console.log();
  }
}

// ---------------------------------------------------------------------------
// Register service commands
// ---------------------------------------------------------------------------

/** Convert tool name to CLI sub-command (snake_case → kebab-case minus service prefix) */
function toolToSubcommand(tool: ToolDef, service: ServiceDef): string {
  const prefix = service.name.replace(/-/g, '_') + '_';
  const name = tool.name.startsWith(prefix)
    ? tool.name.slice(prefix.length)
    : tool.name;
  return name.replace(/_/g, '-');
}

function buildProgram(): Command {
  const program = new Command();

  program
    .name('worldmonitor')
    .description(
      'CLI + MCP server for accessing World Monitor intelligence data — military, financial, geopolitical, cyber, infrastructure, and environmental sources.',
    )
    .version('1.0.0')
    .option(
      '--base-url <url>',
      'World Monitor API base URL',
      'https://worldmonitor.app',
    )
    .option('--api-key <key>', 'API key for authenticated access')
    .option('--timeout <ms>', 'Request timeout in milliseconds', '30000')
    .option(
      '--format <format>',
      'Output format: json, json-pretty, raw',
      'json-pretty',
    )
    .option('--list-tools', 'List all available tools and exit')
    .option('--mcp', 'Start as MCP server (stdio transport)');

  // Register service groups and their tool sub-commands
  for (const service of allServices) {
    const svcCmd = program
      .command(service.name)
      .description(service.description);

    for (const tool of service.tools) {
      const subName = toolToSubcommand(tool, service);
      const sub = svcCmd.command(subName).description(tool.description);

      // Register options from tool params
      if (tool.params) {
        for (const [paramName, paramDef] of Object.entries(tool.params)) {
          const flag = `--${paramName} <value>`;
          if (paramDef.required) {
            sub.requiredOption(flag, paramDef.description);
          } else {
            sub.option(flag, paramDef.description);
          }
        }
      }

      // Capture service/tool in closure
      const capturedService = service;
      const capturedTool = tool;

      sub.action(async (opts: Record<string, string>) => {
        const globals = program.opts();
        const config = loadConfig({
          baseUrl: globals.baseUrl,
          apiKey: globals.apiKey,
          timeout: parseInt(globals.timeout, 10),
        });
        const client = new WorldMonitorClient(config);
        const format = globals.format as OutputFormat;

        // Build params — coerce types based on tool param definitions
        const params: Record<string, unknown> = {};
        if (capturedTool.params) {
          for (const [key, def] of Object.entries(capturedTool.params)) {
            const raw = opts[camelCase(key)] ?? opts[key];
            if (raw === undefined) continue;

            switch (def.type) {
              case 'number':
                params[key] = Number(raw);
                break;
              case 'boolean':
                params[key] = raw === 'true' || raw === '1';
                break;
              case 'string[]':
                params[key] = raw.split(',').map((s: string) => s.trim());
                break;
              default:
                params[key] = raw;
            }
          }
        }

        // Check for direct handler first (external API calls)
        const handler = directHandlers[capturedTool.name];
        if (handler) {
          try {
            const data = await handler(params);
            console.log(
              format === 'json'
                ? JSON.stringify(data)
                : JSON.stringify(data, null, 2),
            );
          } catch (err: unknown) {
            const message =
              err instanceof Error ? err.message : 'Unknown error';
            console.error(
              JSON.stringify({ error: true, message }, null, 2),
            );
            process.exit(1);
          }
          return;
        }

        // Proxy through WorldMonitorClient
        const fullPath = capturedService.basePath + capturedTool.endpoint;
        const result = await client.call(
          fullPath,
          Object.keys(params).length > 0 ? params : undefined,
          capturedTool.method ?? 'GET',
        );

        console.log(formatOutput(result, format));

        if (!result.ok) process.exit(1);
      });
    }
  }

  return program;
}

/** Convert snake_case to camelCase (commander normalizes option names) */
function camelCase(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Handle --list-tools and --mcp before commander parses
  const handled = await handleSpecialFlags();
  if (handled) return;

  // Normal CLI mode — parse commands
  const program = buildProgram();
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error('Fatal:', err.message ?? err);
  process.exit(1);
});
