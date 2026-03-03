import { ServiceDef } from '../types.js';

export const government: ServiceDef = {
  name: 'government',
  description:
    'Government data — Federal Register regulations, federal contract spending from USAspending.gov, and OFAC/trade.gov sanctions searches',
  basePath: '/api/government/v1',
  tools: [
    {
      name: 'search_federal_register',
      description:
        'Search the Federal Register for regulations, proposed rules, notices, and presidential documents. Useful for identifying regulatory actions that affect specific sectors.',
      params: {
        q: {
          type: 'string',
          description: 'Search query (e.g. "cryptocurrency regulation", "emissions standards")',
          required: true,
        },
        document_type: {
          type: 'string',
          description:
            'Filter by type: "RULE", "PRORULE" (proposed rule), "NOTICE", "PRESDOCU" (presidential document)',
        },
        agency: {
          type: 'string',
          description:
            'Filter by agency (e.g. "Securities and Exchange Commission", "Environmental Protection Agency")',
        },
        per_page: {
          type: 'number',
          description: 'Results per page (default 20, max 1000)',
        },
      },
      endpoint: '/search-federal-register',
    },
    {
      name: 'get_government_contracts',
      description:
        'Get federal government contract awards from USAspending.gov — contractor name, award amount, agency, and description.',
      params: {
        keyword: {
          type: 'string',
          description: 'Search keyword for contract description',
        },
        agency: {
          type: 'string',
          description: 'Funding agency name filter (e.g. "Department of Defense")',
        },
        min_amount: {
          type: 'number',
          description: 'Minimum award amount in USD',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 25)',
        },
      },
      endpoint: '/get-government-contracts',
      method: 'POST',
    },
    {
      name: 'get_sanctions_search',
      description:
        'Search the consolidated screening list (OFAC SDN, Entity List, etc.) for sanctioned individuals, entities, and vessels.',
      params: {
        name: {
          type: 'string',
          description: 'Name to search for',
          required: true,
        },
        type: {
          type: 'string',
          description: 'Entity type filter: "individual", "entity", "vessel"',
        },
      },
      endpoint: '/get-sanctions-search',
    },
  ],
};
