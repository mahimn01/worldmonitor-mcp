import { ServiceDef } from '../types.js';

export const market: ServiceDef = {
  name: 'market',
  description:
    'Financial market data — stock quotes, crypto prices, commodities, sector performance, stablecoin peg health, BTC ETF flows, country indices, and Gulf region markets',
  basePath: '/api/market/v1',
  tools: [
    {
      name: 'list_market_quotes',
      description:
        'Get real-time stock and index quotes from Finnhub and Yahoo Finance. Supports major indices (^GSPC, ^DJI, ^IXIC, ^VIX), futures (GC=F, CL=F), and individual stocks.',
      params: {
        symbols: {
          type: 'string[]',
          description:
            'Comma-separated ticker symbols (e.g. "AAPL,MSFT,^GSPC,GC=F"). Leave empty for default watchlist.',
        },
      },
      endpoint: '/list-market-quotes',
    },
    {
      name: 'list_crypto_quotes',
      description:
        'Get cryptocurrency prices and market data from CoinGecko — price, 24h change, market cap, volume for top coins.',
      params: {
        ids: {
          type: 'string[]',
          description:
            'Comma-separated CoinGecko IDs (e.g. "bitcoin,ethereum,solana,ripple"). Leave empty for top coins.',
        },
      },
      endpoint: '/list-crypto-quotes',
    },
    {
      name: 'list_commodity_quotes',
      description:
        'Get commodity futures prices — gold (GC=F), crude oil (CL=F), natural gas (NG=F), silver (SI=F), copper (HG=F).',
      params: {
        symbols: {
          type: 'string[]',
          description:
            'Comma-separated Yahoo Finance commodity symbols (e.g. "GC=F,CL=F,NG=F")',
        },
      },
      endpoint: '/list-commodity-quotes',
    },
    {
      name: 'get_sector_summary',
      description:
        'Get sector ETF performance summary — shows performance across Technology (XLK), Healthcare (XLV), Financials (XLF), Energy (XLE), etc.',
      params: {
        period: {
          type: 'string',
          description: 'Time period (e.g. "1d", "5d", "1mo", "3mo", "ytd")',
        },
      },
      endpoint: '/get-sector-summary',
    },
    {
      name: 'list_stablecoin_markets',
      description:
        'Get stablecoin peg health data — USDT, USDC, DAI, FDUSD, USDe with price deviation from $1.00.',
      params: {
        coins: {
          type: 'string[]',
          description:
            'Comma-separated CoinGecko stablecoin IDs (e.g. "tether,usd-coin,dai")',
        },
      },
      endpoint: '/list-stablecoin-markets',
    },
    {
      name: 'list_etf_flows',
      description:
        'Get BTC spot ETF flow data — tracks IBIT, FBTC, GBTC, ARKB, HODL, BRRR, and other Bitcoin ETF inflows/outflows.',
      endpoint: '/list-etf-flows',
    },
    {
      name: 'get_country_stock_index',
      description:
        'Get the primary stock market index for a given country (e.g. S&P 500 for US, Nikkei for JP, DAX for DE).',
      params: {
        country_code: {
          type: 'string',
          description:
            'ISO 3166-1 alpha-2 country code (e.g. "US", "JP", "DE", "GB")',
          required: true,
        },
      },
      endpoint: '/get-country-stock-index',
    },
    {
      name: 'list_gulf_quotes',
      description:
        'Get Gulf Cooperation Council (GCC) market data — Tadawul (Saudi), Dubai Financial Market, Abu Dhabi (ADX), Qatar Exchange, Muscat MSM 30, plus Gulf currencies and oil prices.',
      endpoint: '/list-gulf-quotes',
    },
  ],
};
