import { ServiceDef } from '../types.js';

export const research: ServiceDef = {
  name: 'research',
  description:
    'Tech research and ecosystem data — arXiv AI/ML papers, GitHub trending repos, Hacker News top stories, and upcoming tech events/conferences',
  basePath: '/api/research/v1',
  tools: [
    {
      name: 'list_arxiv_papers',
      description:
        'Get recent arXiv papers — AI, machine learning, NLP, computer vision, and other CS research papers with abstracts and citation data.',
      params: {
        page_size: {
          type: 'number',
          description: 'Results per page',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor',
        },
        category: {
          type: 'string',
          description:
            'arXiv category (e.g. "cs.AI", "cs.LG", "cs.CL", "cs.CV", "stat.ML")',
        },
        query: {
          type: 'string',
          description:
            'Search query (e.g. "transformer", "reinforcement learning", "LLM")',
        },
      },
      endpoint: '/list-arxiv-papers',
    },
    {
      name: 'list_trending_repos',
      description:
        'Get trending GitHub repositories — shows popular repos by language and time period.',
      params: {
        page_size: {
          type: 'number',
          description: 'Results per page',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor',
        },
        language: {
          type: 'string',
          description:
            'Programming language filter (e.g. "python", "typescript", "rust")',
        },
        period: {
          type: 'string',
          description:
            'Time period: "daily", "weekly", "monthly"',
        },
      },
      endpoint: '/list-trending-repos',
    },
    {
      name: 'list_hackernews_items',
      description:
        'Get Hacker News stories — top, new, or best stories from the YC Hacker News community.',
      params: {
        page_size: {
          type: 'number',
          description: 'Results per page',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor',
        },
        feed_type: {
          type: 'string',
          description:
            'Feed type: "top", "new", "best", "ask", "show"',
        },
      },
      endpoint: '/list-hackernews-items',
    },
    {
      name: 'list_tech_events',
      description:
        'Get upcoming tech events and conferences — CES, WWDC, Google I/O, re:Invent, and other major technology conferences.',
      params: {
        type: {
          type: 'string',
          description: 'Event type filter',
        },
        mappable: {
          type: 'boolean',
          description:
            'Only return events with geographic coordinates',
        },
        limit: {
          type: 'number',
          description: 'Max events to return (0-500)',
        },
        days: {
          type: 'number',
          description: 'Days ahead to look for events',
        },
      },
      endpoint: '/list-tech-events',
    },
  ],
};
