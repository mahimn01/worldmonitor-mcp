import { ServiceDef } from '../types.js';

/**
 * Legacy endpoints that are NOT part of the proto service system.
 * These are standalone Vercel serverless functions and Railway relay endpoints.
 */
export const legacy: ServiceDef = {
  name: 'legacy',
  description:
    'Legacy endpoints — bootstrap data cache, RSS proxy, AIS vessel snapshots, GPS jamming, OREF alerts (Israel), Polymarket proxy, Telegram OSINT feeds, YouTube live detection, and more',
  basePath: '/api',
  tools: [
    {
      name: 'get_bootstrap_data',
      description:
        'Get bulk cached data in a single request — earthquakes, outages, service statuses, sector performance, ETF flows, macro signals, BIS data, shipping rates, chokepoints, minerals, giving, climate anomalies, and wildfires. Much faster than calling individual endpoints.',
      params: {
        tier: {
          type: 'string',
          description:
            'Cache tier: "fast" (10min TTL — earthquakes, outages, statuses, macro) or "slow" (1hr TTL — sectors, BIS, shipping, minerals, climate, wildfires)',
        },
        keys: {
          type: 'string[]',
          description:
            'Specific cache keys to fetch (comma-separated). Available: earthquakes, outages, serviceStatuses, sectors, etfFlows, macroSignals, bisPolicy, bisExchange, bisCredit, shippingRates, chokepoints, minerals, giving, climateAnomalies, wildfires',
        },
      },
      endpoint: '/bootstrap',
    },
    {
      name: 'proxy_rss_feed',
      description:
        'Proxy an RSS/Atom feed through the World Monitor RSS proxy — handles CORS, blocked domains, and provides Railway relay fallback for rate-limited sources. 325+ whitelisted domains.',
      params: {
        url: {
          type: 'string',
          description: 'Full RSS/Atom feed URL to proxy',
          required: true,
        },
      },
      endpoint: '/rss-proxy',
    },
    {
      name: 'get_ais_snapshot',
      description:
        'Get a snapshot of AIS vessel positions from the Railway relay — aggregated maritime vessel data from AISStream.io.',
      endpoint: '/ais-snapshot',
    },
    {
      name: 'get_gps_jamming',
      description:
        'Get GPS/GNSS jamming zone data — hexagonal grid of areas with detected GPS interference, based on aircraft ADS-B signal analysis from gpsjam.org.',
      endpoint: '/gpsjam',
    },
    {
      name: 'get_oref_alerts',
      description:
        'Get Israel Home Front Command (OREF) rocket/siren alerts — current active alerts and 24-hour history count.',
      endpoint: '/oref-alerts',
    },
    {
      name: 'get_opensky_aircraft',
      description:
        'Get aircraft positions from OpenSky Network via the Railway relay — raw ADS-B data for all tracked aircraft in a region.',
      endpoint: '/opensky',
    },
    {
      name: 'get_polymarket_data',
      description:
        'Get prediction market data from Polymarket via the Railway relay proxy.',
      endpoint: '/polymarket',
    },
    {
      name: 'get_eia_petroleum',
      description:
        'Get petroleum data from EIA — WTI crude, Brent crude, US oil production, and inventory levels with weekly changes.',
      endpoint: '/eia/petroleum',
    },
    {
      name: 'get_telegram_feed',
      description:
        'Get Telegram OSINT channel feed — early signal intelligence from curated Telegram channels via Railway relay.',
      params: {
        limit: {
          type: 'number',
          description: 'Max items to return (default 50, max 200)',
        },
        topic: {
          type: 'string',
          description: 'Topic filter for channel selection',
        },
        channel: {
          type: 'string',
          description: 'Specific channel name to fetch',
        },
      },
      endpoint: '/telegram-feed',
    },
    {
      name: 'detect_youtube_live',
      description:
        'Check if a YouTube channel or video is currently live streaming — useful for monitoring live news feeds.',
      params: {
        channel: {
          type: 'string',
          description: 'YouTube channel ID or handle',
        },
        videoId: {
          type: 'string',
          description: 'Specific YouTube video ID to check',
        },
      },
      endpoint: '/youtube/live',
    },
    {
      name: 'get_geo_location',
      description:
        'Get the country code of the requesting IP address — uses Cloudflare/Vercel IP geolocation headers.',
      endpoint: '/geo',
    },
    {
      name: 'get_app_version',
      description:
        'Get the latest World Monitor release version information from GitHub.',
      endpoint: '/version',
    },
  ],
};
