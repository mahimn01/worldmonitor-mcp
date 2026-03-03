# worldmonitor-mcp

MCP server + CLI for accessing [World Monitor](https://worldmonitor.app) intelligence data. Provides **107 tools** across **32 services** covering military, financial, geopolitical, cyber, infrastructure, environmental, and direct-API financial intelligence sources.

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
node bin/worldmonitor.js sec-edgar get-sec-insider-trades --ticker AAPL

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
npm test         # run 297 tests (all should pass)
```

Most tools work with zero configuration. The 77 proxy tools call the public World Monitor API. The 30 direct-API tools call free external APIs — some optionally benefit from API keys (see below).

## Configuration

### Environment Variables

| Variable | CLI Flag | Default | Description |
|---|---|---|---|
| `WORLDMONITOR_BASE_URL` | `--base-url` | `https://worldmonitor.app` | API base URL |
| `WORLDMONITOR_API_KEY` | `--api-key` | — | API key (if your instance requires auth) |
| `WORLDMONITOR_TIMEOUT` | `--timeout` | `30000` | Request timeout in ms |

### Optional API Keys (all free tier)

Copy `.env.example` to `.env` and add keys for enhanced functionality:

```bash
cp .env.example .env
```

| Key | Tools Enhanced | Get Free Key |
|---|---|---|
| `FINNHUB_API_KEY` | Earnings calendar, IPO calendar | [finnhub.io/register](https://finnhub.io/register) |
| `FRED_API_KEY` | Economic calendar (primary source) | [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) |
| `USDA_API_KEY` | Crop reports, drought monitor | [quickstats.nass.usda.gov/api](https://quickstats.nass.usda.gov/api) |
| `OPENSANCTIONS_API_KEY` | Enhanced sanctions search | [opensanctions.org](https://opensanctions.org) |

**Without any keys**, the following direct tools still work fully: SEC EDGAR (5 tools), Treasury (3), CFTC (2), On-Chain DeFi (4), Article Extraction (2), NOAA Weather, Federal Register, Government Contracts, Congressional Trades, OFAC Sanctions, Fear & Greed Index, CBOE Options Flow, Reddit Sentiment.

## All 107 Tools

### SEC EDGAR (5 tools) — Direct API, no key needed
| Tool | Description |
|---|---|
| `get_sec_insider_trades` | Form 4 insider trading filings — who's buying/selling |
| `get_sec_13f_holdings` | 13F institutional holdings — what hedge funds own |
| `get_sec_filings` | Company SEC filings (10-K, 10-Q, 8-K, etc.) |
| `get_sec_company_facts` | XBRL financial facts — revenue, EPS, assets directly from filings |
| `get_sec_full_text_search` | Full-text search across all SEC filings |

### Treasury (3 tools) — Direct API, no key needed
| Tool | Description |
|---|---|
| `get_treasury_rates` | Daily Treasury yield curve rates (T-bills through 30-year bonds) |
| `get_treasury_auctions` | Recent Treasury auction results |
| `get_national_debt` | Current US national debt figures |

### CFTC (2 tools) — Direct API, no key needed
| Tool | Description |
|---|---|
| `get_cot_positions` | Commitments of Traders data — commercial/non-commercial positioning |
| `get_cot_summary` | COT summary across major futures contracts |

### Congress (2 tools) — Capitol Trades scraping, no key needed
| Tool | Description |
|---|---|
| `list_congress_trades` | Recent congressional stock trades from STOCK Act disclosures |
| `get_congress_member_trades` | Trades by a specific member of Congress |

### Economic Calendar (3 tools) — FRED free key recommended
| Tool | Description |
|---|---|
| `get_economic_calendar` | Upcoming economic data releases (uses FRED API) |
| `get_earnings_calendar` | Upcoming earnings reports (Finnhub free tier) |
| `get_ipo_calendar` | Upcoming IPOs (Finnhub free tier) |

### Weather & Agriculture (3 tools) — USDA key recommended
| Tool | Description |
|---|---|
| `get_weather_forecast` | NOAA 7-day weather forecast for any US lat/lon |
| `get_crop_report` | USDA crop production data by commodity and state |
| `get_drought_monitor` | Drought conditions via USDA crop condition ratings |

### Government (3 tools) — Direct API, no key needed
| Tool | Description |
|---|---|
| `search_federal_register` | Search Federal Register for rules, proposed rules, notices |
| `get_government_contracts` | Federal contract awards from USAspending.gov |
| `get_sanctions_search` | OFAC SDN sanctions list search (5.4M+ entries) |

### On-Chain DeFi (4 tools) — DefiLlama, no key needed
| Tool | Description |
|---|---|
| `get_chain_tvl` | Total Value Locked by blockchain (Ethereum, Solana, etc.) |
| `get_protocol_tvl` | TVL for a specific DeFi protocol |
| `get_stablecoin_flows` | Stablecoin market cap and chain distribution |
| `get_defi_yields` | Top DeFi yield opportunities across protocols |

### Sentiment (3 tools) — Free, no key needed
| Tool | Description |
|---|---|
| `get_social_sentiment` | Reddit r/wallstreetbets sentiment for any ticker — buzz level, top posts, scores |
| `get_fear_greed_detail` | Crypto Fear & Greed Index with 30 days of history and trend analysis |
| `get_options_flow` | CBOE full options chain — put/call ratio, top contracts by volume, IV, sentiment |

### Article Extraction (2 tools) — Direct fetch, no key needed
| Tool | Description |
|---|---|
| `extract_article` | Extract full article text from any URL (bypasses soft paywalls via Google Cache/Archive.org) |
| `search_and_extract` | Search GDELT for articles on a topic, then extract the best match |

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
# List all 107 tools
worldmonitor --list-tools

# === Direct API Tools (no key needed) ===

# SEC EDGAR
worldmonitor sec-edgar get-sec-insider-trades --ticker AAPL
worldmonitor sec-edgar get-sec-13f-holdings --cik 0001067983  # Berkshire Hathaway
worldmonitor sec-edgar get-sec-company-facts --ticker MSFT
worldmonitor sec-edgar get-sec-full-text-search --query "artificial intelligence"

# Treasury
worldmonitor treasury get-treasury-rates
worldmonitor treasury get-treasury-auctions --security_type Bill
worldmonitor treasury get-national-debt

# CFTC Positioning
worldmonitor cftc get-cot-positions --contract_code 099741  # S&P 500
worldmonitor cftc get-cot-summary

# Congressional Trading
worldmonitor congress list-congress-trades
worldmonitor congress get-congress-member-trades --member "Pelosi"

# On-Chain DeFi
worldmonitor onchain get-chain-tvl
worldmonitor onchain get-protocol-tvl --protocol aave
worldmonitor onchain get-stablecoin-flows
worldmonitor onchain get-defi-yields

# Sentiment & Options
worldmonitor sentiment get-social-sentiment --symbol TSLA
worldmonitor sentiment get-options-flow --symbol SPY
worldmonitor sentiment get-fear-greed-detail

# Government & Sanctions
worldmonitor government search-federal-register --q "cryptocurrency"
worldmonitor government get-government-contracts --keyword "artificial intelligence"
worldmonitor government get-sanctions-search --name "Putin"

# Weather & Agriculture
worldmonitor weather-agriculture get-weather-forecast --lat 40.7128 --lon -74.006
worldmonitor weather-agriculture get-crop-report --commodity corn --state IL
worldmonitor weather-agriculture get-drought-monitor --state CA

# Article Extraction
worldmonitor article extract-article --url "https://example.com/article"
worldmonitor article search-and-extract --query "Fed interest rate decision"

# === Proxy Tools (via World Monitor API) ===

# Military
worldmonitor military list-flights --operator US --aircraft_type TANKER
worldmonitor military get-theater-posture --theater middle-east
worldmonitor military get-usni-fleet-report

# Markets
worldmonitor market list-market-quotes --symbols AAPL,MSFT,GOOG,^VIX
worldmonitor market list-crypto-quotes --ids bitcoin,ethereum,solana
worldmonitor market list-gulf-quotes

# Economic
worldmonitor economic get-fred-series --series_id GDP --limit 20
worldmonitor economic get-macro-signals
worldmonitor economic get-bis-policy-rates

# Intelligence
worldmonitor intelligence get-risk-scores
worldmonitor intelligence get-country-intel-brief --country_code CN
worldmonitor intelligence search-gdelt-documents --query "Taiwan strait" --timespan 24h

# Natural Events
worldmonitor seismology list-earthquakes --min_magnitude 6
worldmonitor wildfire list-fire-detections --ne_lat 45 --ne_lon -110 --sw_lat 35 --sw_lon -125

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

Once connected, your AI assistant can call any of the 107 tools directly. For example:

- "What are Nancy Pelosi's recent stock trades?"
- "Show me SEC insider trades for Apple"
- "What's the put/call ratio on SPY options right now?"
- "Is anyone on the OFAC sanctions list named Petrov?"
- "Show me the Treasury yield curve"
- "What's the latest COT positioning for S&P 500 futures?"
- "What earthquakes happened today above magnitude 5?"
- "Get the DeFi TVL breakdown by chain"

## Architecture

```
src/
├── cli.ts                 # CLI entry point (commander.js)
├── mcp.ts                 # MCP server entry point (stdio transport)
├── client.ts              # HTTP client for World Monitor API
├── config.ts              # Configuration loading (env vars + overrides)
├── output.ts              # Output formatting (json, json-pretty, raw)
├── types.ts               # TypeScript type definitions (DirectHandler type)
├── handlers/              # Direct API handlers (call external APIs directly)
│   ├── index.ts           # Handler registry — maps tool names to functions
│   ├── _http.ts           # Shared fetch wrapper (TLS bypass, redirects, timeouts)
│   ├── sec-edgar.ts       # 5 handlers → SEC EDGAR APIs
│   ├── treasury.ts        # 3 handlers → Treasury Fiscal Data API
│   ├── cftc.ts            # 2 handlers → CFTC Socrata API
│   ├── congress.ts        # 2 handlers → Capitol Trades scraping
│   ├── economic-calendar.ts # 3 handlers → FRED + Finnhub
│   ├── weather-agriculture.ts # 3 handlers → NOAA + USDA NASS
│   ├── government.ts      # 3 handlers → Federal Register, USAspending, OFAC
│   ├── onchain.ts         # 4 handlers → DefiLlama
│   ├── sentiment.ts       # 3 handlers → Reddit, alternative.me, CBOE
│   └── article.ts         # 2 handlers → Direct fetch + Google Cache + Archive.org
├── services/              # Declarative service + tool definitions
│   ├── index.ts           # Service registry (auto-registers all 32 services)
│   ├── military.ts        # 7 tools
│   ├── market.ts          # 8 tools
│   ├── economic.ts        # 8 tools
│   ├── sec-edgar.ts       # 5 tools (direct)
│   ├── ... (32 service files total)
│   └── legacy.ts          # 12 tools (non-proto endpoints)
└── __tests__/             # 297 tests
    ├── client.test.ts
    ├── config.test.ts
    ├── output.test.ts
    ├── cli.test.ts
    ├── mcp.test.ts
    ├── handlers/
    │   └── direct-integration.test.ts
    └── services/
        ├── registry.test.ts
        └── integration.test.ts
```

### Dual Execution Path

```
Proxy tools (77):   Claude → MCP/CLI → WorldMonitorClient → worldmonitor.app → external API
Direct tools (30):  Claude → MCP/CLI → directHandlers[name]() → external API (direct)
```

**Data-driven design:** Every tool is a declarative config object. The CLI and MCP server both iterate over the same service definitions to auto-register commands/tools. Direct handlers are matched by tool name before falling through to the proxy path. To add a new tool, just add an object to a service file and optionally a handler function.

## Adding New Tools

### Proxy Tool (uses World Monitor API)

Add a tool definition to the appropriate service file:

```typescript
// src/services/military.ts
{
  name: 'my_new_tool',
  description: 'What this tool does',
  params: {
    country: { type: 'string', description: 'Country code', required: true },
  },
  endpoint: '/my-new-endpoint',
  method: 'GET',
}
```

### Direct API Tool (calls external API directly)

1. Add the handler function in `src/handlers/`:

```typescript
// src/handlers/my-service.ts
const myHandler: DirectHandler = async (params) => {
  return fetchJson(`https://api.example.com/data?q=${params.query}`);
};
export const myHandlers = { my_new_tool: myHandler };
```

2. Register in `src/handlers/index.ts`
3. Add tool definition in `src/services/my-service.ts`

Both types automatically appear in the CLI and MCP server.

## Testing

```bash
npm test              # run all 297 tests
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
```

## Data Sources

This tool provides access to data from 50+ external sources including:

- **Financial Intelligence:** SEC EDGAR, US Treasury, CFTC, Capitol Trades, FRED, Finnhub, USDA NASS
- **DeFi/Crypto:** DefiLlama, CoinGecko, Alternative.me, Mempool.space
- **Market Data:** Finnhub, Yahoo Finance, CBOE Options
- **Sentiment:** Reddit r/wallstreetbets, Fear & Greed Index, CBOE Put/Call Ratios
- **Government:** Federal Register, USAspending, OFAC SDN List, NOAA
- **Military:** OpenSky Network, Wingbits, USNI Fleet Tracker
- **Economic:** FRED (800k+ series), World Bank, EIA, BIS
- **Geopolitical:** ACLED, UCDP, GDELT 2.0, HAPI/HDX
- **Cyber:** Feodo Tracker, URLhaus, AlienVault OTX, AbuseIPDB, C2IntelFeeds
- **Infrastructure:** Cloudflare Radar, NGA Maritime Warnings
- **Trade:** WTO Timeseries API
- **Natural Events:** USGS Earthquakes, NASA FIRMS, NASA/NOAA Climate
- **News:** 150+ RSS feeds, article extraction with paywall bypass
- **Other:** Polymarket, Telegram OSINT, YouTube live detection

## License

MIT
