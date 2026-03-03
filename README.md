# worldmonitor-mcp

MCP server + CLI for accessing [World Monitor](https://worldmonitor.app) intelligence data. Provides **77 tools** across **22 services** covering military, financial, geopolitical, cyber, infrastructure, and environmental data sources.

Works with **Claude Code**, **Cursor**, **Windsurf**, and any MCP-compatible AI assistant.

## Quick Start

### As MCP Server (Claude Code)

```bash
# Clone and build
git clone https://github.com/mahimn01/worldmonitor-mcp.git
cd worldmonitor-mcp
npm install
npm run build

# Add to Claude Code
claude mcp add worldmonitor -- node /absolute/path/to/worldmonitor-mcp/dist/mcp.js
```

Or run directly without cloning:

```bash
npx worldmonitor-mcp
```

### As CLI

```bash
# Clone and build
git clone https://github.com/mahimn01/worldmonitor-mcp.git
cd worldmonitor-mcp
npm install
npm run build

# Run commands
node bin/worldmonitor.js seismology list-earthquakes --min_magnitude 6
node bin/worldmonitor.js market list-crypto-quotes --ids bitcoin,ethereum,solana
node bin/worldmonitor.js intelligence get-country-intel-brief --country_code UA

# Or link globally
npm link
worldmonitor military list-flights --operator US
```

### Development Mode (no build step)

```bash
npm install
npx tsx src/cli.ts --list-tools
npx tsx src/cli.ts seismology list-earthquakes --min_magnitude 5
npx tsx src/mcp.ts  # start MCP server
```

## Setup After Cloning

```bash
git clone https://github.com/mahimn01/worldmonitor-mcp.git
cd worldmonitor-mcp
npm install      # install dependencies
npm run build    # compile TypeScript
npm test         # run 211 tests (all should pass)
```

That's it. No API keys needed — the tool calls the public World Monitor API at `https://worldmonitor.app`.

## Configuration

Configuration via environment variables or CLI flags:

| Variable | CLI Flag | Default | Description |
|---|---|---|---|
| `WORLDMONITOR_BASE_URL` | `--base-url` | `https://worldmonitor.app` | API base URL |
| `WORLDMONITOR_API_KEY` | `--api-key` | — | API key (if your instance requires auth) |
| `WORLDMONITOR_TIMEOUT` | `--timeout` | `30000` | Request timeout in ms |

Copy `.env.example` to `.env` to customize:

```bash
cp .env.example .env
```

## All 77 Tools

### Military (7 tools)
| Tool | Description |
|---|---|
| `list_military_flights` | Live military aircraft positions from ADS-B tracking (OpenSky Network) |
| `get_theater_posture` | Military posture assessment for a theater region (Europe, Middle East, Indo-Pacific, Arctic) |
| `get_aircraft_details` | Detailed info for a specific aircraft by ICAO 24-bit hex address |
| `get_aircraft_details_batch` | Batch aircraft details (up to 20 at once) |
| `get_wingbits_status` | Wingbits aircraft enrichment service status |
| `get_usni_fleet_report` | US Naval Institute fleet deployment report — carrier strike groups worldwide |
| `list_military_bases` | 220+ military bases from 9 operators, filterable by region/type/country |

### Market (8 tools)
| Tool | Description |
|---|---|
| `list_market_quotes` | Real-time stock/index quotes (Finnhub + Yahoo Finance) |
| `list_crypto_quotes` | Cryptocurrency prices from CoinGecko |
| `list_commodity_quotes` | Commodity futures — gold, oil, natural gas, silver, copper |
| `get_sector_summary` | Sector ETF performance (XLK, XLV, XLF, XLE, etc.) |
| `list_stablecoin_markets` | Stablecoin peg health — USDT, USDC, DAI, FDUSD, USDe |
| `list_etf_flows` | Bitcoin spot ETF flows — IBIT, FBTC, GBTC, ARKB, etc. |
| `get_country_stock_index` | Primary stock index for any country |
| `list_gulf_quotes` | GCC markets — Tadawul, Dubai FM, Abu Dhabi, Qatar, Muscat, Gulf currencies |

### Economic (8 tools)
| Tool | Description |
|---|---|
| `get_fred_series` | Federal Reserve Economic Data — GDP, unemployment, CPI, interest rates, 800k+ series |
| `list_world_bank_indicators` | World Bank development indicators |
| `get_energy_prices` | Energy prices from EIA — WTI, Brent, natural gas |
| `get_macro_signals` | 7-signal macro dashboard — Bitcoin technicals, Fear & Greed, JPY liquidity, regime detection |
| `get_energy_capacity` | Renewable energy capacity — solar, wind, nuclear |
| `get_bis_policy_rates` | Central bank policy rates from BIS (12 major central banks) |
| `get_bis_exchange_rates` | Real effective exchange rates (REER) from BIS |
| `get_bis_credit` | Credit-to-GDP ratios from BIS |

### Intelligence (6 tools)
| Tool | Description |
|---|---|
| `get_risk_scores` | Geopolitical risk scores for 23 tier-1 nations |
| `get_pizzint_status` | Pentagon Pizza Index — crisis activity proxy |
| `classify_event` | AI-powered event classification (type, severity, confidence) |
| `get_country_intel_brief` | AI-generated intelligence briefing for any country |
| `search_gdelt_documents` | Search GDELT 2.0 global events database |
| `deduct_situation` | AI situation analysis with current headline context |

### Infrastructure (5 tools)
| Tool | Description |
|---|---|
| `list_internet_outages` | Internet outages from Cloudflare Radar (ASN-level) |
| `list_service_statuses` | Major internet service operational status |
| `get_temporal_baseline` | Anomaly detection baselines (Welford's algorithm) |
| `record_baseline_snapshot` | Update temporal baseline metrics |
| `get_cable_health` | Undersea cable health from NGA maritime warnings |

### Conflict (4 tools)
| Tool | Description |
|---|---|
| `list_acled_events` | ACLED conflict data — battles, violence, protests worldwide |
| `list_ucdp_events` | Uppsala Conflict Data Program armed conflict events |
| `get_humanitarian_summary` | Humanitarian crisis summary per country |
| `list_iran_events` | Curated Iran-specific conflict and tension events |

### Trade (4 tools)
| Tool | Description |
|---|---|
| `get_trade_restrictions` | Active trade restrictions/sanctions from WTO |
| `get_tariff_trends` | Historical tariff rates between country pairs |
| `get_trade_flows` | Bilateral merchandise trade flows |
| `get_trade_barriers` | SPS/TBT trade barriers from WTO |

### Research (4 tools)
| Tool | Description |
|---|---|
| `list_arxiv_papers` | Recent arXiv AI/ML/NLP/CV papers |
| `list_trending_repos` | Trending GitHub repositories by language |
| `list_hackernews_items` | Hacker News top/new/best stories |
| `list_tech_events` | Upcoming tech conferences and events |

### News (3 tools)
| Tool | Description |
|---|---|
| `summarize_article` | AI article summarization (Groq/OpenRouter/Ollama) |
| `get_summarize_article_cache` | Retrieve cached article summaries |
| `list_feed_digest` | Batch digest from 20+ RSS feeds |

### Supply Chain (3 tools)
| Tool | Description |
|---|---|
| `get_shipping_rates` | Global shipping rate indices |
| `get_chokepoint_status` | Maritime chokepoint status (Suez, Panama, Hormuz, Malacca) |
| `get_critical_minerals` | Critical mineral supply concentration by country |

### Maritime (2 tools)
| Tool | Description |
|---|---|
| `get_vessel_snapshot` | AIS vessel positions in a geographic area |
| `list_navigational_warnings` | NGA navigational warnings — cable work, military exercises, piracy |

### Displacement (2 tools)
| Tool | Description |
|---|---|
| `get_displacement_summary` | UNHCR/IDMC refugee and IDP data with YoY trends |
| `get_population_exposure` | Population exposure analysis for a geographic point |

### Single-Tool Services
| Tool | Description |
|---|---|
| `list_airport_delays` | Airport delays/closures from FAA, AviationStack, ICAO NOTAMs |
| `list_cyber_threats` | Cyber threat IOCs from 5 intel sources (Feodo, URLhaus, OTX, AbuseIPDB) |
| `list_climate_anomalies` | Climate anomalies from NASA/NOAA |
| `list_earthquakes` | USGS earthquakes (M4.5+ default) |
| `list_fire_detections` | NASA FIRMS satellite fire hotspots |
| `list_prediction_markets` | Polymarket prediction market odds |
| `list_unrest_events` | Social unrest — protests, riots, strikes (ACLED + GDELT) |
| `get_giving_summary` | Global humanitarian giving trends |
| `list_positive_geo_events` | Positive global events — peace, environmental wins |

### Legacy Endpoints (12 tools)
| Tool | Description |
|---|---|
| `get_bootstrap_data` | Bulk cached data (earthquakes, outages, sectors, BIS, minerals, etc.) |
| `proxy_rss_feed` | RSS feed proxy (325+ whitelisted domains) |
| `get_ais_snapshot` | AIS vessel snapshot from Railway relay |
| `get_gps_jamming` | GPS/GNSS jamming zones |
| `get_oref_alerts` | Israel OREF rocket/siren alerts |
| `get_opensky_aircraft` | Raw OpenSky aircraft data |
| `get_polymarket_data` | Polymarket prediction data |
| `get_eia_petroleum` | EIA petroleum data (WTI, Brent, production, inventory) |
| `get_telegram_feed` | Telegram OSINT channel feed |
| `detect_youtube_live` | YouTube live stream detection |
| `get_geo_location` | IP geolocation (country code) |
| `get_app_version` | Latest World Monitor release version |

## CLI Usage Examples

```bash
# List all tools
worldmonitor --list-tools

# Military
worldmonitor military list-flights --operator US --aircraft_type TANKER
worldmonitor military get-theater-posture --theater middle-east
worldmonitor military get-usni-fleet-report

# Markets
worldmonitor market list-market-quotes --symbols AAPL,MSFT,GOOG,^VIX
worldmonitor market list-crypto-quotes --ids bitcoin,ethereum,solana
worldmonitor market list-gulf-quotes
worldmonitor market get-sector-summary --period 1d

# Economic
worldmonitor economic get-fred-series --series_id GDP --limit 20
worldmonitor economic get-macro-signals
worldmonitor economic get-bis-policy-rates

# Intelligence
worldmonitor intelligence get-risk-scores
worldmonitor intelligence get-country-intel-brief --country_code CN
worldmonitor intelligence search-gdelt-documents --query "Taiwan strait" --timespan 24h

# Conflict
worldmonitor conflict list-acled-events --country UA
worldmonitor conflict get-humanitarian-summary --country_code SY

# Natural Events
worldmonitor seismology list-earthquakes --min_magnitude 6
worldmonitor wildfire list-fire-detections --ne_lat 45 --ne_lon -110 --sw_lat 35 --sw_lon -125
worldmonitor climate list-climate-anomalies

# Infrastructure
worldmonitor infrastructure list-internet-outages --country IR
worldmonitor infrastructure get-cable-health

# Bulk data
worldmonitor legacy get-bootstrap-data --tier fast
worldmonitor legacy get-bootstrap-data --keys earthquakes,outages,macroSignals

# Output formats
worldmonitor seismology list-earthquakes --format json          # compact JSON
worldmonitor seismology list-earthquakes --format json-pretty   # pretty-printed (default)
worldmonitor seismology list-earthquakes --format raw           # raw response
```

## MCP Server Integration

### Claude Code

```bash
# Option 1: From local clone
claude mcp add worldmonitor -- node /path/to/worldmonitor-mcp/dist/mcp.js

# Option 2: With custom base URL
claude mcp add worldmonitor -- node /path/to/worldmonitor-mcp/dist/mcp.js --base-url https://your-instance.com

# Option 3: Start from CLI
worldmonitor --mcp
```

### Cursor / Windsurf / Other MCP Clients

Add to your MCP config (e.g. `~/.cursor/mcp.json`):

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

Once connected, your AI assistant can call any of the 77 tools directly. For example, you can ask:

- "What earthquakes happened today above magnitude 5?"
- "Show me the current military theater posture in Europe"
- "What are Bitcoin and Ethereum prices right now?"
- "Are there any internet outages in Iran?"
- "Get the latest USNI fleet deployment report"

## Architecture

```
src/
├── cli.ts                 # CLI entry point (commander.js)
├── mcp.ts                 # MCP server entry point (stdio transport)
├── client.ts              # HTTP client for World Monitor API
├── config.ts              # Configuration loading (env vars + overrides)
├── output.ts              # Output formatting (json, json-pretty, raw)
├── types.ts               # TypeScript type definitions
├── services/
│   ├── index.ts           # Service registry (auto-registers all services)
│   ├── military.ts        # 7 tools
│   ├── market.ts          # 8 tools
│   ├── economic.ts        # 8 tools
│   ├── intelligence.ts    # 6 tools
│   ├── infrastructure.ts  # 5 tools
│   ├── conflict.ts        # 4 tools
│   ├── trade.ts           # 4 tools
│   ├── research.ts        # 4 tools
│   ├── news.ts            # 3 tools
│   ├── supply-chain.ts    # 3 tools
│   ├── maritime.ts        # 2 tools
│   ├── displacement.ts    # 2 tools
│   ├── aviation.ts        # 1 tool
│   ├── cyber.ts           # 1 tool
│   ├── climate.ts         # 1 tool
│   ├── seismology.ts      # 1 tool
│   ├── wildfire.ts        # 1 tool
│   ├── prediction.ts      # 1 tool
│   ├── unrest.ts          # 1 tool
│   ├── giving.ts          # 1 tool
│   ├── positive-events.ts # 1 tool
│   └── legacy.ts          # 12 tools (non-proto endpoints)
└── __tests__/             # 211 tests
    ├── client.test.ts
    ├── config.test.ts
    ├── output.test.ts
    ├── cli.test.ts
    ├── mcp.test.ts
    └── services/
        ├── registry.test.ts
        └── integration.test.ts
```

**Data-driven design:** Every tool is a declarative config object. The CLI and MCP server both iterate over the same service definitions to auto-register commands/tools. To add a new tool, just add an object to a service file — no wiring required.

## Adding New Tools

Add a tool definition to the appropriate service file:

```typescript
// src/services/military.ts
{
  name: 'my_new_tool',
  description: 'What this tool does',
  params: {
    country: {
      type: 'string',
      description: 'Country code',
      required: true,
    },
  },
  endpoint: '/my-new-endpoint',
  method: 'GET',  // or 'POST'
}
```

It will automatically appear in both the CLI (`worldmonitor military my-new-tool --country US`) and MCP server.

## Testing

```bash
npm test              # run all 211 tests
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
```

## Data Sources

This tool provides access to data from 40+ external sources including:

- **Military:** OpenSky Network, Wingbits, USNI Fleet Tracker
- **Financial:** Finnhub, Yahoo Finance, CoinGecko, Alternative.me, Mempool.space
- **Economic:** FRED, World Bank, EIA, BIS
- **Geopolitical:** ACLED, UCDP, GDELT 2.0, HAPI/HDX
- **Cyber:** Feodo Tracker, URLhaus, AlienVault OTX, AbuseIPDB, C2IntelFeeds
- **Infrastructure:** Cloudflare Radar, NGA Maritime Warnings
- **Trade:** WTO Timeseries API
- **Natural Events:** USGS Earthquakes, NASA FIRMS, NASA/NOAA Climate
- **Maritime:** AISStream.io, NGA
- **News:** 150+ RSS feeds, Groq/OpenRouter/Ollama for AI summarization
- **Other:** Polymarket, Telegram OSINT, YouTube live detection

## License

MIT
