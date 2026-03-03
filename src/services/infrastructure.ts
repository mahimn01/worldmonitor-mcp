import { ServiceDef } from '../types.js';

export const infrastructure: ServiceDef = {
  name: 'infrastructure',
  description:
    'Global infrastructure monitoring — internet outages (Cloudflare Radar), service statuses, temporal baselines for anomaly detection, and undersea cable health',
  basePath: '/api/infrastructure/v1',
  tools: [
    {
      name: 'list_internet_outages',
      description:
        'Get internet outages detected by Cloudflare Radar — ASN-level outage events with geographic location, start/end times, and affected networks.',
      params: {
        start: {
          type: 'number',
          description: 'Start timestamp (Unix ms)',
        },
        end: {
          type: 'number',
          description: 'End timestamp (Unix ms)',
        },
        page_size: {
          type: 'number',
          description: 'Results per page',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor',
        },
        country: {
          type: 'string',
          description:
            'Filter by country code (e.g. "IR", "RU", "MM")',
        },
      },
      endpoint: '/list-internet-outages',
    },
    {
      name: 'list_service_statuses',
      description:
        'Get operational status of major internet services and platforms — detects degraded performance and outages.',
      params: {
        status: {
          type: 'string',
          description:
            'Filter by status: "operational", "degraded", "outage"',
        },
      },
      endpoint: '/list-service-statuses',
    },
    {
      name: 'get_temporal_baseline',
      description:
        'Get temporal baseline statistics for anomaly detection — uses Welford\'s online algorithm to compute mean/variance for a metric type.',
      params: {
        type: {
          type: 'string',
          description:
            'Metric type (e.g. "outages", "earthquakes", "fires")',
          required: true,
        },
        region: {
          type: 'string',
          description: 'Region identifier',
        },
        count: {
          type: 'number',
          description: 'Current count to compare against baseline',
        },
      },
      endpoint: '/get-temporal-baseline',
    },
    {
      name: 'record_baseline_snapshot',
      description:
        'Record a temporal baseline snapshot — updates the running mean/variance for anomaly detection metrics.',
      params: {
        updates: {
          type: 'string',
          description:
            'JSON array of {type, region, count} objects to record',
          required: true,
        },
      },
      endpoint: '/record-baseline-snapshot',
      method: 'POST',
    },
    {
      name: 'get_cable_health',
      description:
        'Get undersea cable health status — checks NGA maritime warnings for submarine cable advisories affecting global internet infrastructure.',
      endpoint: '/get-cable-health',
    },
  ],
};
