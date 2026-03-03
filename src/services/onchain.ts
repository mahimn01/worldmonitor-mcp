import { ServiceDef } from '../types.js';

export const onchain: ServiceDef = {
  name: 'onchain',
  description:
    'On-chain DeFi data from DefiLlama — protocol TVL, chain TVL breakdown, stablecoin market cap flows, and DeFi overview',
  basePath: '/api/onchain/v1',
  tools: [
    {
      name: 'get_defi_overview',
      description:
        'Get DeFi overview — top protocols by TVL, total DeFi TVL, and category breakdown (DEXes, Lending, Bridges, CDP, Yield, etc.).',
      params: {
        limit: {
          type: 'number',
          description: 'Max protocols to return (default 25)',
        },
        category: {
          type: 'string',
          description:
            'Filter by category (e.g. "Dexes", "Lending", "Bridge", "CDP", "Yield", "Liquid Staking")',
        },
      },
      endpoint: '/get-defi-overview',
    },
    {
      name: 'get_protocol_tvl',
      description:
        'Get detailed TVL data for a specific DeFi protocol — current TVL, chain breakdown, historical TVL, and token info.',
      params: {
        protocol: {
          type: 'string',
          description:
            'Protocol slug name (e.g. "aave", "uniswap", "lido", "makerdao", "eigen-layer")',
          required: true,
        },
      },
      endpoint: '/get-protocol-tvl',
    },
    {
      name: 'get_stablecoin_flows',
      description:
        'Get stablecoin market data — total market cap, individual stablecoin metrics, and chain distribution for USDT, USDC, DAI, etc.',
      params: {
        include_prices: {
          type: 'boolean',
          description: 'Include current price data (default true)',
        },
      },
      endpoint: '/get-stablecoin-flows',
    },
    {
      name: 'get_chain_tvl',
      description:
        'Get TVL by blockchain — total value locked on Ethereum, Solana, BSC, Arbitrum, Base, and other chains.',
      endpoint: '/get-chain-tvl',
    },
  ],
};
