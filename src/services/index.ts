/**
 * Service registry — all service definitions in one place.
 * Both the CLI and MCP server iterate over this list to auto-register.
 */

import { ServiceDef } from '../types.js';
import { military } from './military.js';
import { market } from './market.js';
import { news } from './news.js';
import { economic } from './economic.js';
import { intelligence } from './intelligence.js';
import { infrastructure } from './infrastructure.js';
import { conflict } from './conflict.js';
import { aviation } from './aviation.js';
import { maritime } from './maritime.js';
import { cyber } from './cyber.js';
import { climate } from './climate.js';
import { seismology } from './seismology.js';
import { wildfire } from './wildfire.js';
import { trade } from './trade.js';
import { supplyChain } from './supply-chain.js';
import { displacement } from './displacement.js';
import { prediction } from './prediction.js';
import { research } from './research.js';
import { unrest } from './unrest.js';
import { giving } from './giving.js';
import { positiveEvents } from './positive-events.js';
// Direct-handler services (call external APIs directly, not via worldmonitor.app)
import { secEdgar } from './sec-edgar.js';
import { treasury } from './treasury.js';
import { cftc } from './cftc.js';
import { congress } from './congress.js';
import { economicCalendar } from './economic-calendar.js';
import { weatherAgriculture } from './weather-agriculture.js';
import { government } from './government.js';
import { onchain } from './onchain.js';
import { sentiment } from './sentiment.js';
import { article } from './article.js';
import { legacy } from './legacy.js';

/** All proto-first services (31 services: 21 proxy + 10 direct) */
export const protoServices: ServiceDef[] = [
  military,
  market,
  news,
  economic,
  intelligence,
  infrastructure,
  conflict,
  aviation,
  maritime,
  cyber,
  climate,
  seismology,
  wildfire,
  trade,
  supplyChain,
  displacement,
  prediction,
  research,
  unrest,
  giving,
  positiveEvents,
  // Direct-handler services
  secEdgar,
  treasury,
  cftc,
  congress,
  economicCalendar,
  weatherAgriculture,
  government,
  onchain,
  sentiment,
  article,
];

/** Legacy (non-proto) endpoints */
export const legacyServices: ServiceDef[] = [legacy];

/** Every service combined */
export const allServices: ServiceDef[] = [
  ...protoServices,
  ...legacyServices,
];

/** Flat list of every tool across all services */
export function allTools() {
  return allServices.flatMap((svc) =>
    svc.tools.map((tool) => ({
      ...tool,
      service: svc.name,
      fullEndpoint: svc.basePath + tool.endpoint,
    })),
  );
}

/** Lookup a specific tool by name */
export function findTool(name: string) {
  for (const svc of allServices) {
    for (const tool of svc.tools) {
      if (tool.name === name) {
        return { ...tool, service: svc.name, fullEndpoint: svc.basePath + tool.endpoint };
      }
    }
  }
  return undefined;
}
