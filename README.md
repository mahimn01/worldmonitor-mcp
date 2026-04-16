# worldmonitor-mcp

MCP server and CLI that wraps [koala73/worldmonitor](https://github.com/koala73/worldmonitor), an open-source global intelligence dashboard. This exposes 140 tools across 32 services to Claude Code, Cursor, Windsurf, and any other MCP client so you can ask models for live market, geopolitical, military, cyber, climate, and supply chain data.

Most services proxy the public [worldmonitor.app](https://worldmonitor.app) API. A handful bypass it and hit underlying data providers directly (SEC EDGAR, FRED, Finnhub, USDA, NOAA, CFTC, and others). Those are the extensions. The dashboard itself isn't mine, [koala73](https://github.com/koala73) built that. This repo is just the MCP wrapper plus a few direct additions.

## Install

```bash
# as a one-off
npx worldmonitor-mcp

# or install globally
npm install -g worldmonitor-mcp
```

To use from Claude Code, add this to your MCP config.

```json
{
  "mcpServers": {
    "worldmonitor": {
      "command": "npx",
      "args": ["worldmonitor-mcp"]
    }
  }
}
```

The CLI also works as a standalone tool.

```bash
worldmonitor list-earthquakes
worldmonitor list-market-quotes --symbols AAPL,NVDA
worldmonitor get-fred-series --series GDP
```

## What's in it

32 services grouped by what they cover.

| Category | Services |
|---|---|
| Markets and financial | market, economic, treasury, cftc, congress, onchain, sentiment |
| Geopolitics and intel | intelligence, conflict, military, unrest, displacement |
| News and research | news, research, article |
| Environmental | climate, weather-agriculture, wildfire, seismology |
| Supply chain and trade | supply-chain, maritime, trade |
| Infrastructure and cyber | infrastructure, cyber, aviation |
| Government and regulation | government, sec-edgar, economic-calendar |
| Humanitarian | giving, positive-events |
| Predictions | prediction |
| Legacy bulk and cache | legacy |

21 of the 32 services proxy the upstream WorldMonitor API. 10 services hit underlying providers directly (SEC EDGAR, FRED, Finnhub, USDA, NOAA, CFTC, CBOE, Treasury Fiscal Data, Fear & Greed, Federal Register, Reddit, Gov Contracts, OpenSanctions). The legacy service mixes Vercel serverless and a Railway relay for rate-limited upstream APIs.

## Env vars

None of these are required. Defaults work out of the box.

| Variable | Purpose | Default |
|---|---|---|
| `WORLDMONITOR_BASE_URL` | Upstream worldmonitor.app URL | `https://worldmonitor.app` |
| `WORLDMONITOR_API_KEY` | Upstream API key if you have one | none |
| `WORLDMONITOR_TIMEOUT` | HTTP timeout in ms | `30000` |
| `WORLDMONITOR_MAX_RESPONSE_SIZE` | MCP response size soft cap in bytes | `100000` |
| `FINNHUB_API_KEY` | Earnings/IPO calendar, market quotes | none (optional) |
| `FRED_API_KEY` | FRED economic data | none (optional) |
| `USDA_API_KEY` | Crop and drought reports | none (optional) |
| `OPENSANCTIONS_API_KEY` | Sanctions search enhancement | none (optional) |

The direct-API services mostly work without any keys. Keys unlock the rate-limited or paid endpoints.

## How it works

The wrapper reads a service registry (`src/services/*`) where each service declares its tools, endpoints, and parameter schemas. At startup the MCP server iterates every service and registers every tool. When a tool is called, routing splits two ways. Direct handlers bypass the upstream and call the underlying data provider. Proxy handlers forward to the configured WorldMonitor base URL.

On top of that there's retry-with-backoff on 429 and 5xx responses, response validation that catches broken serverless endpoints returning HTML instead of JSON, known-broken endpoint detection that returns a helpful error instead of a confusing failure, and a response truncation layer that shrinks oversize arrays to fit the MCP context window.

Article extraction has three fallbacks. Direct fetch first, then Google Cache, then Archive.org, with a browser user-agent to bypass soft paywalls.

## Credits

The upstream dashboard is [koala73/worldmonitor](https://github.com/koala73/worldmonitor). It's a real-time global intelligence dashboard with 100+ news feeds, a 3D deck.gl WebGL globe, AI briefs with local LLM support, and Tauri desktop builds for macOS, Windows, and Linux. Licensed AGPL-3.0. If you find this MCP useful, that's the project doing the heavy lifting.

This repo is just the MCP wrapper and the direct-API extensions. No data collection or aggregation lives here.
