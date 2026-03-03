/**
 * Handler registry — combined map of all direct handlers keyed by tool name.
 * If a tool name appears here, it is handled directly rather than proxied
 * through the WorldMonitorClient.
 */

import { DirectHandler } from '../types.js';
import { secEdgarHandlers } from './sec-edgar.js';
import { treasuryHandlers } from './treasury.js';
import { cftcHandlers } from './cftc.js';
import { congressHandlers } from './congress.js';
import { economicCalendarHandlers } from './economic-calendar.js';
import { weatherAgricultureHandlers } from './weather-agriculture.js';
import { governmentHandlers } from './government.js';
import { onchainHandlers } from './onchain.js';
import { sentimentHandlers } from './sentiment.js';
import { articleHandlers } from './article.js';

export const directHandlers: Record<string, DirectHandler> = {
  ...secEdgarHandlers,
  ...treasuryHandlers,
  ...cftcHandlers,
  ...congressHandlers,
  ...economicCalendarHandlers,
  ...weatherAgricultureHandlers,
  ...governmentHandlers,
  ...onchainHandlers,
  ...sentimentHandlers,
  ...articleHandlers,
};
