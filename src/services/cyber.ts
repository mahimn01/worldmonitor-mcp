import { ServiceDef } from '../types.js';

export const cyber: ServiceDef = {
  name: 'cyber',
  description:
    'Cyber threat intelligence — C2 server IPs (Feodo Tracker), malware URLs (URLhaus), threat indicators (AlienVault OTX), IP reputation (AbuseIPDB), geo-located on a map',
  basePath: '/api/cyber/v1',
  tools: [
    {
      name: 'list_cyber_threats',
      description:
        'Get cyber threat indicators from 5 intelligence sources: Feodo Tracker (C2 botnet IPs), URLhaus (malware URLs), C2IntelFeeds, AlienVault OTX, and AbuseIPDB. Results are geo-located.',
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
          description: 'Results per page (max 2000)',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor',
        },
        type: {
          type: 'string',
          description:
            'Threat type filter: "c2", "malware_url", "botnet", "threat_indicator"',
        },
        source: {
          type: 'string',
          description:
            'Source filter: "feodo", "urlhaus", "c2intel", "otx", "abuseipdb"',
        },
        min_severity: {
          type: 'string',
          description:
            'Minimum severity: "low", "medium", "high", "critical"',
        },
      },
      endpoint: '/list-cyber-threats',
    },
  ],
};
