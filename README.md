# worldmonitor-mcp

MCP server and CLI that wraps [koala73/worldmonitor](https://github.com/koala73/worldmonitor), an open-source global intelligence dashboard. This exposes 112 tools across 33 services to Claude Code, Cursor, Windsurf, and any other MCP client so you can ask models for live market, geopolitical, military, cyber, climate, and supply chain data.

Most services proxy the public [worldmonitor.app](https://worldmonitor.app) API. A handful bypass it and hit underlying data providers directly (SEC EDGAR, FRED, Finnhub, USDA, NOAA, CFTC, and others), and one service fuses the rest into scored trading briefs. Those are the extensions. The dashboard itself isn't mine, [koala73](https://github.com/koala73) built that. This repo is just the MCP wrapper plus the additions.

## Install

Not published to npm yet — install from source:

```bash
git clone https://github.com/mahimn01/worldmonitor-mcp.git
cd worldmonitor-mcp
npm install
npm run build
```

To use from Claude Code:

```bash
claude mcp add worldmonitor -- node /absolute/path/to/worldmonitor-mcp/dist/mcp.js
```

Or in any MCP client config:

```json
{
  "mcpServers": {
    "worldmonitor": {
      "command": "node",
      "args": ["/absolute/path/to/worldmonitor-mcp/dist/mcp.js"]
    }
  }
}
```

The CLI works as a standalone tool (`npm link` to get `worldmonitor` on your PATH, or use `node dist/cli.js` / `npx tsx src/cli.ts`). Commands are grouped by service:

```bash
worldmonitor seismology list-earthquakes --min_magnitude 6
worldmonitor market list-market-quotes --symbols AAPL,NVDA
worldmonitor economic get-fred-series --series_id GDP
worldmonitor trading get-ticker-intel --symbol NVDA
worldmonitor --list-tools
```

## What's in it

33 services grouped by what they cover.

| Category | Services |
|---|---|
| Markets and financial | market, economic, treasury, cftc, congress, onchain, sentiment, trading |
| Geopolitics and intel | intelligence, conflict, military, unrest, displacement |
| News and research | news, research, article |
| Environmental | climate, weather-agriculture, wildfire, seismology |
| Supply chain and trade | supply-chain, maritime, trade |
| Infrastructure and cyber | infrastructure, cyber, aviation |
| Government and regulation | government, sec-edgar, economic-calendar |
| Humanitarian | giving, positive-events |
| Predictions | prediction |
| Legacy bulk and cache | legacy |

21 of the 33 services proxy the upstream WorldMonitor API. 11 services hit underlying providers directly (SEC EDGAR, FRED, Finnhub, CapitolTrades, DefiLlama, USDA, NOAA, CFTC, CBOE, Treasury Fiscal Data, Fear & Greed, Federal Register, Reddit, Gov Contracts, OpenSanctions) or fuse other tools. The legacy service mixes Vercel serverless and a Railway relay for rate-limited upstream APIs.

## Trading intelligence

The `trading` service fuses the other feeds into scored, ranked briefs instead of making the model stitch raw payloads together.

| Tool | What it does |
|---|---|
| `get_ticker_intel` | One ticker, one brief: quote, options flow, social buzz, earnings proximity, congressional trades, and parsed insider activity fused into a 0-100 conviction score |
| `scan_convergence` | Ranks tickers by how many independent directional signals agree (price, options put/call, insider net, congress net) |
| `get_energy_risk` | Energy supply-risk gauge from prices, chokepoint warnings, military posture, news tone, AIS, and conflict events |
| `get_changes_since` | What changed in a feed (congress / insider / options) since a timestamp, diffed against a local snapshot store |

There's also `get_insider_activity` under sec-edgar: it parses Form 4 XML for actual open-market buys vs sells with share counts and dollar values, which the plain filing list can't tell you.

Every conviction and energy-risk score ships with its factor breakdown, per-feed coverage, and a confidence number; scores are withheld when coverage is too low. Convergence scan results carry per-signal votes and a conflict flag instead. Feeds that fail degrade to coverage flags, never fabricated factors. All of it is read-only and informational, not investment advice.

The server also registers MCP resources (`watchlist://default`, `brief://today`) and prompts (`morning_brief`, `pre_earnings_check`, `ticker_deep_dive`).

## Env vars

None of these are required. Defaults work out of the box, and empty values are treated as unset, so `cp .env.example .env` is safe.

| Variable | Purpose | Default |
|---|---|---|
| `WORLDMONITOR_BASE_URL` | Upstream worldmonitor.app URL | `https://worldmonitor.app` |
| `WORLDMONITOR_API_KEY` | Upstream API key if you have one | none |
| `WORLDMONITOR_TIMEOUT` | HTTP timeout in ms | `30000` |
| `WORLDMONITOR_MAX_RESPONSE_SIZE` | MCP response size soft cap in characters | `100000` |
| `WORLDMONITOR_DATA_DIR` | SQLite cache/state dir (persistence needs Node ≥ 22.5, otherwise in-memory) | `~/.cache/worldmonitor` |
| `WORLDMONITOR_WATCHLIST` | Comma-separated symbols for the watchlist resource and scan universe | `SPY,QQQ,^VIX` |
| `WORLDMONITOR_CACHE_TTL` | TTL in seconds for the cached brief resource | `900` |
| `SEC_USER_AGENT` | Email-shaped User-Agent for SEC EDGAR (SEC rejects URL-style UAs) | built-in |
| `FINNHUB_API_KEY` | Earnings/IPO calendars; fallback source for the economic calendar (premium), congressional trades, and social sentiment | none (optional) |
| `FRED_API_KEY` | Economic calendar release schedule | none (optional) |
| `USDA_API_KEY` | Crop and drought reports | none (optional) |
| `OPENSANCTIONS_API_KEY` | Sanctions search enhancement | none (optional) |

The direct-API services mostly work without any keys. Keys unlock the rate-limited or fallback endpoints.

## How it works

The wrapper reads a service registry (`src/services/*`) where each service declares its tools, endpoints, and parameter schemas. At startup the MCP server iterates every service and registers every tool with read-only annotations (all but one — `record_baseline_snapshot` mutates upstream snapshot state and is flagged accordingly), and the composite tools additionally declare structured output schemas. When a tool is called, routing splits two ways. Direct handlers bypass the upstream and call the underlying data provider. Proxy handlers forward to the configured WorldMonitor base URL.

Composite tools fan out to other tools through an internal dispatcher with a concurrency cap, per-feed TTL caching, in-flight coalescing, and a shared SEC rate limiter, so a scan doesn't turn into a request storm. Snapshots land in a local SQLite store (in-memory fallback on older Nodes) that powers the change-detection tool across sessions.

On top of that there's retry-with-backoff on 429/500/502/503/504 responses and network errors, response validation that catches broken serverless endpoints returning HTML instead of JSON, known-broken endpoint detection that returns a helpful error instead of a confusing failure, and a response truncation layer that shrinks oversize arrays to fit the MCP context window.

Article extraction has three fallbacks. Direct fetch first, then Google Cache, then Archive.org, with a browser user-agent to bypass soft paywalls.

## Credits

The upstream dashboard is [koala73/worldmonitor](https://github.com/koala73/worldmonitor). It's a real-time global intelligence dashboard with 100+ news feeds, a 3D deck.gl WebGL globe, AI briefs with local LLM support, and Tauri desktop builds for macOS, Windows, and Linux. Licensed AGPL-3.0. If you find this MCP useful, that's the project doing the heavy lifting.

This repo is just the MCP wrapper, the direct-API extensions, and the composite trading layer. No data collection or aggregation lives here.
