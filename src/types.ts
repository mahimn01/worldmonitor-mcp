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
}

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
