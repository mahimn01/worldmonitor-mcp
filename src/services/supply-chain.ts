import { ServiceDef } from '../types.js';

export const supplyChain: ServiceDef = {
  name: 'supply-chain',
  description:
    'Global supply chain monitoring — shipping rates (Clarkson indices), chokepoint status (Suez/Panama), and critical mineral supply data',
  basePath: '/api/supply-chain/v1',
  tools: [
    {
      name: 'get_shipping_rates',
      description:
        'Get global shipping rate indices — container freight rates, dry bulk indices, and tanker rates from Clarkson and World Bank Logistics Performance data.',
      endpoint: '/get-shipping-rates',
    },
    {
      name: 'get_chokepoint_status',
      description:
        'Get status of critical maritime chokepoints — Suez Canal, Panama Canal, Strait of Hormuz, Strait of Malacca, Bab el-Mandeb. Shows transit volumes, delays, and disruptions.',
      endpoint: '/get-chokepoint-status',
    },
    {
      name: 'get_critical_minerals',
      description:
        'Get critical mineral supply data — production concentrations for lithium, cobalt, rare earths, nickel, copper, gallium, and germanium. Shows supply chain vulnerability by country.',
      endpoint: '/get-critical-minerals',
    },
  ],
};
