/**
 * On-chain DeFi direct handlers — DefiLlama protocol TVL, chain TVL,
 * stablecoin flows, and DeFi overview.
 */

import { DirectHandler } from '../types.js';
import { fetchJson } from './_http.js';

const LLAMA_API = 'https://api.llama.fi';
const STABLECOINS_API = 'https://stablecoins.llama.fi';

const getDefiOverview: DirectHandler = async (params) => {
  const limit = (params.limit as number) || 25;
  const category = params.category as string | undefined;

  const protocols = await fetchJson<Record<string, unknown>[]>(
    `${LLAMA_API}/protocols`,
  );

  let filtered = protocols;
  if (category) {
    const lc = category.toLowerCase();
    filtered = protocols.filter(
      (p) => (p.category as string)?.toLowerCase() === lc,
    );
  }

  // Return top protocols by TVL (already sorted by DefiLlama)
  return {
    total_protocols: protocols.length,
    filtered_count: filtered.length,
    protocols: filtered.slice(0, limit).map((p) => ({
      name: p.name,
      symbol: p.symbol,
      category: p.category,
      tvl: p.tvl,
      change_1d: p.change_1d,
      change_7d: p.change_7d,
      chains: p.chains,
      url: p.url,
    })),
  };
};

const getProtocolTvl: DirectHandler = async (params) => {
  const protocol = params.protocol as string;
  return fetchJson(`${LLAMA_API}/protocol/${encodeURIComponent(protocol)}`);
};

const getStablecoinFlows: DirectHandler = async (params) => {
  const includePrices = params.include_prices !== false;
  const url = includePrices
    ? `${STABLECOINS_API}/stablecoins?includePrices=true`
    : `${STABLECOINS_API}/stablecoins`;
  return fetchJson(url);
};

const getChainTvl: DirectHandler = async () => {
  return fetchJson(`${LLAMA_API}/v2/chains`);
};

export const onchainHandlers: Record<string, DirectHandler> = {
  get_defi_overview: getDefiOverview,
  get_protocol_tvl: getProtocolTvl,
  get_stablecoin_flows: getStablecoinFlows,
  get_chain_tvl: getChainTvl,
};
