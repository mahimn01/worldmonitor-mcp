/**
 * Core type definitions for the World Monitor MCP/CLI tool.
 *
 * Every service is defined declaratively as a ServiceDefinition containing
 * ToolDefinitions.  The CLI and MCP server both iterate over these definitions
 * to auto-register commands / tools — no manual wiring required.
 */

// ---------------------------------------------------------------------------
// Parameter & Tool schema
// ---------------------------------------------------------------------------

export type ParamType = 'string' | 'number' | 'boolean' | 'string[]';

export interface ParamDef {
  type: ParamType;
  description: string;
  required?: boolean;
  default?: string | number | boolean;
  enum?: string[];
}

export interface ToolDef {
  /** snake_case identifier — used as MCP tool name and CLI sub-command slug */
  name: string;
  /** Human-readable description shown in MCP tool listing and CLI --help */
  description: string;
  /** Map of parameter name → definition.  Omit for parameter-less endpoints. */
  params?: Record<string, ParamDef>;
  /** API path relative to the service basePath (e.g. "/list-military-flights") */
  endpoint: string;
  /** HTTP method — defaults to GET */
  method?: 'GET' | 'POST';
}

// ---------------------------------------------------------------------------
// Service definition
// ---------------------------------------------------------------------------

export interface ServiceDef {
  /** kebab-case service name used as the top-level CLI group */
  name: string;
  /** Short description of what data this service provides */
  description: string;
  /** API path prefix (e.g. "/api/military/v1") */
  basePath: string;
  /** All tools (endpoints) belonging to this service */
  tools: ToolDef[];
}

// ---------------------------------------------------------------------------
// Client types
// ---------------------------------------------------------------------------

export interface ClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  /** Directory for the SQLite cache/state DB (default ~/.cache/worldmonitor) */
  dataDir: string;
  /** Watchlist symbols surfaced via the watchlist:// resource */
  watchlist: string[];
  /** Where the watchlist came from (for transparency in the resource) */
  watchlistSource: 'env' | 'file' | 'default' | 'override';
  /** Default TTL (seconds) for cached composite responses */
  cacheTtlSeconds: number;
}

/** The subset of ClientConfig the HTTP client actually needs. */
export type ClientConnection = Pick<ClientConfig, 'baseUrl' | 'apiKey' | 'timeout'>;

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
  headers: Record<string, string>;
  elapsed: number;
}

export interface ApiError {
  ok: false;
  status: number;
  message: string;
  elapsed: number;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type OutputFormat = 'json' | 'json-pretty' | 'raw';

// ---------------------------------------------------------------------------
// Direct handler type (for tools that call external APIs directly)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tool context (passed to handlers that compose other tools / use the store)
// ---------------------------------------------------------------------------

// Type-only imports — erased at compile time, so no runtime import cycle.
import type { WorldMonitorClient } from './client.js';
import type { Store } from './store.js';

/**
 * Shared context handed to direct handlers as an optional second argument.
 * Legacy handlers ignore it; composite handlers use it to invoke other tools
 * (proxy or direct) and to read/write the cache + snapshot store.
 */
export interface ToolContext {
  client: WorldMonitorClient;
  store: Store;
  /** The resolved config this context was built with (watchlist, TTLs, …). */
  config?: ClientConfig;
  /** Invoke any registered tool by name (direct or proxied); returns unwrapped data. */
  callTool(name: string, params?: Record<string, unknown>): Promise<unknown>;
}

/**
 * A direct handler function takes validated params and returns the result
 * directly, bypassing the WorldMonitorClient proxy. The optional `ctx` second
 * argument is provided by the MCP server for composite/stateful handlers.
 */
export type DirectHandler = (
  params: Record<string, unknown>,
  ctx?: ToolContext,
) => Promise<unknown>;
