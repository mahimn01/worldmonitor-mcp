import { ServiceDef } from '../types.js';

export const news: ServiceDef = {
  name: 'news',
  description:
    'News aggregation and AI summarization — 150+ RSS feeds, multi-provider article summarization, and batch feed digests',
  basePath: '/api/news/v1',
  tools: [
    {
      name: 'summarize_article',
      description:
        'Use AI to summarize news headlines. Supports multiple LLM providers (Groq, OpenRouter, Ollama) with automatic fallback. Can generate brief summaries, detailed analysis, or translations.',
      params: {
        provider: {
          type: 'string',
          description:
            'LLM provider to use: "groq", "openrouter", or "ollama"',
          required: true,
        },
        headlines: {
          type: 'string[]',
          description:
            'Comma-separated headlines to summarize (min 1)',
          required: true,
        },
        mode: {
          type: 'string',
          description:
            'Summarization mode: "brief" (default), "analysis", or "translate"',
        },
        geo_context: {
          type: 'string',
          description:
            'Geopolitical context to inject into the summary prompt',
        },
        variant: {
          type: 'string',
          description: 'Site variant: "full", "tech", or "finance"',
        },
        lang: {
          type: 'string',
          description:
            'Target language code for translations (e.g. "es", "fr", "ar")',
        },
      },
      endpoint: '/summarize-article',
      method: 'POST',
    },
    {
      name: 'get_summarize_article_cache',
      description:
        'Retrieve a previously cached article summary by its cache key. Avoids re-running the LLM for already-summarized content.',
      params: {
        cache_key: {
          type: 'string',
          description: 'Cache key from a previous summarize response',
          required: true,
        },
      },
      endpoint: '/summarize-article-cache',
    },
    {
      name: 'list_feed_digest',
      description:
        'Get a batch digest of recent articles from 20+ RSS feeds. Returns pre-aggregated headlines from tier-1 and tier-2 news sources.',
      params: {
        variant: {
          type: 'string',
          description:
            'Site variant for feed selection: "full", "tech", or "finance"',
        },
        lang: {
          type: 'string',
          description: 'Language code for locale-boosted feeds (e.g. "en", "fr", "ar")',
        },
      },
      endpoint: '/list-feed-digest',
    },
  ],
};
