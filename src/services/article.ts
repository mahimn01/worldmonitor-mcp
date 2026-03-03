import { ServiceDef } from '../types.js';

export const article: ServiceDef = {
  name: 'article',
  description:
    'Article extraction — extract full text from any URL with multi-strategy paywall bypass (direct fetch, Google Cache, Archive.org), plus search-and-extract for topic research',
  basePath: '/api/article/v1',
  tools: [
    {
      name: 'extract_article',
      description:
        'Extract full article text from a URL. Uses multi-strategy approach: direct fetch with browser UA (catches JS-only soft paywalls), Google Cache fallback, Archive.org Wayback Machine fallback, then Readability-style content extraction. Returns title, author, date, content, word count.',
      params: {
        url: {
          type: 'string',
          description: 'URL of the article to extract',
          required: true,
        },
        include_html: {
          type: 'boolean',
          description:
            'Include raw HTML content in response (default false)',
        },
      },
      endpoint: '/extract-article',
    },
    {
      name: 'search_and_extract',
      description:
        'Search for articles by topic via GDELT news search and extract their full content. Returns extracted text for the top matching articles.',
      params: {
        query: {
          type: 'string',
          description:
            'Search query for finding articles (e.g. "Federal Reserve rate decision", "NVIDIA earnings")',
          required: true,
        },
        max_articles: {
          type: 'number',
          description: 'Max articles to extract (default 3, max 5)',
        },
      },
      endpoint: '/search-and-extract',
      method: 'POST',
    },
  ],
};
