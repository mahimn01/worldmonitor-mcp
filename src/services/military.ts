import { ServiceDef } from '../types.js';

export const military: ServiceDef = {
  name: 'military',
  description:
    'Military aircraft tracking (ADS-B), theater posture assessment, aircraft details, fleet reports, and base locations',
  basePath: '/api/military/v1',
  tools: [
    {
      name: 'list_military_flights',
      description:
        'Get live military aircraft positions from ADS-B tracking via OpenSky Network. Filter by bounding box, operator (NATO country), or aircraft type.',
      params: {
        page_size: {
          type: 'number',
          description: 'Max results per page (default 100)',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor from previous response',
        },
        ne_lat: {
          type: 'number',
          description: 'Northeast latitude of bounding box',
        },
        ne_lon: {
          type: 'number',
          description: 'Northeast longitude of bounding box',
        },
        sw_lat: {
          type: 'number',
          description: 'Southwest latitude of bounding box',
        },
        sw_lon: {
          type: 'number',
          description: 'Southwest longitude of bounding box',
        },
        operator: {
          type: 'string',
          description:
            'Filter by military operator (e.g. US, GB, FR, DE, IL, RU, CN)',
        },
        aircraft_type: {
          type: 'string',
          description:
            'Filter by aircraft type (e.g. FIGHTER, BOMBER, TANKER, TRANSPORT, SURVEILLANCE, HELICOPTER)',
        },
      },
      endpoint: '/list-military-flights',
    },
    {
      name: 'get_theater_posture',
      description:
        'Get military posture assessment for a theater region — counts aircraft by type, detects surges, and computes escalation signals.',
      params: {
        theater: {
          type: 'string',
          description:
            'Theater name (e.g. "europe", "middle-east", "indo-pacific", "arctic")',
          required: true,
        },
      },
      endpoint: '/get-theater-posture',
    },
    {
      name: 'get_aircraft_details',
      description:
        'Get detailed information about a specific military aircraft by its ICAO 24-bit hex address — includes owner, operator, type, registration.',
      params: {
        icao24: {
          type: 'string',
          description: 'ICAO 24-bit hex address of the aircraft',
          required: true,
        },
      },
      endpoint: '/get-aircraft-details',
    },
    {
      name: 'get_aircraft_details_batch',
      description:
        'Get detailed information for multiple aircraft at once (max 20). Returns owner, operator, type, and registration for each.',
      params: {
        icao24s: {
          type: 'string[]',
          description:
            'Comma-separated ICAO 24-bit hex addresses (max 20)',
          required: true,
        },
      },
      endpoint: '/get-aircraft-details-batch',
      method: 'POST',
    },
    {
      name: 'get_wingbits_status',
      description:
        'Check the operational status of the Wingbits aircraft enrichment service.',
      endpoint: '/get-wingbits-status',
    },
    {
      name: 'get_usni_fleet_report',
      description:
        'Get the latest USNI (US Naval Institute) fleet deployment report — shows where US Navy carrier strike groups and amphibious ready groups are deployed globally.',
      params: {
        force_refresh: {
          type: 'boolean',
          description: 'Force refresh from source (bypass cache)',
        },
      },
      endpoint: '/get-usni-fleet-report',
    },
    {
      name: 'list_military_bases',
      description:
        'Get military base locations — 220+ bases from 9 operators. Filter by geographic bounds, base type, kind, or country.',
      params: {
        ne_lat: {
          type: 'number',
          description: 'Northeast latitude of bounding box',
        },
        ne_lon: {
          type: 'number',
          description: 'Northeast longitude of bounding box',
        },
        sw_lat: {
          type: 'number',
          description: 'Southwest latitude of bounding box',
        },
        sw_lon: {
          type: 'number',
          description: 'Southwest longitude of bounding box',
        },
        zoom: {
          type: 'number',
          description: 'Map zoom level (affects clustering)',
        },
        type: {
          type: 'string',
          description:
            'Base type filter (e.g. "air", "naval", "army", "missile")',
        },
        kind: {
          type: 'string',
          description: 'Base kind filter',
        },
        country: {
          type: 'string',
          description: 'Filter by country code (e.g. "US", "RU")',
        },
      },
      endpoint: '/list-military-bases',
    },
  ],
};
