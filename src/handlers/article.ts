/**
 * Article extraction direct handlers — extract full article text from any URL
 * using a multi-strategy approach (direct fetch, Google Cache, Archive.org).
 * Uses linkedom for lightweight HTML parsing.
 */

import { DirectHandler } from '../types.js';
import { fetchText, fetchJson } from './_http.js';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

interface ExtractedArticle {
  title: string;
  author: string | null;
  date: string | null;
  content: string;
  word_count: number;
  url: string;
  source_strategy: string;
}

/**
 * Extract article content from raw HTML using Readability-style heuristics.
 */
async function parseArticleFromHtml(
  html: string,
  url: string,
): Promise<Omit<ExtractedArticle, 'source_strategy'>> {
  // Dynamic import — only loaded when article extraction is used
  const { parseHTML } = await import('linkedom');
  const { document } = parseHTML(html);

  // Extract title from meta tags or <title>
  const ogTitle = document
    .querySelector('meta[property="og:title"]')
    ?.getAttribute('content');
  const titleEl = document.querySelector('title');
  const title = ogTitle || titleEl?.textContent || '';

  // Extract author
  const author =
    document.querySelector('meta[name="author"]')?.getAttribute('content') ??
    document
      .querySelector('meta[property="article:author"]')
      ?.getAttribute('content') ??
    null;

  // Extract date
  const date =
    document
      .querySelector('meta[property="article:published_time"]')
      ?.getAttribute('content') ??
    document.querySelector('meta[name="date"]')?.getAttribute('content') ??
    document.querySelector('time')?.getAttribute('datetime') ??
    null;

  // Remove unwanted elements
  const selectors = [
    'script',
    'style',
    'nav',
    'header',
    'footer',
    'aside',
    'iframe',
    'noscript',
    '.advertisement',
    '.ad',
    '.ads',
    '.sidebar',
    '.social-share',
    '.comments',
    '.related-articles',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="complementary"]',
    '[aria-hidden="true"]',
  ];
  const unwanted = document.querySelectorAll(selectors.join(', '));
  for (const el of unwanted) el.remove();

  // Find main content container
  const contentEl =
    document.querySelector('article') ??
    document.querySelector('[role="main"]') ??
    document.querySelector('.post-content') ??
    document.querySelector('.article-body') ??
    document.querySelector('.article-content') ??
    document.querySelector('.entry-content') ??
    document.querySelector('.story-body') ??
    document.querySelector('main');

  let content = '';
  if (contentEl) {
    const paragraphs = contentEl.querySelectorAll('p');
    content = Array.from(paragraphs)
      .map((p: Element) => (p as unknown as { textContent: string }).textContent?.trim())
      .filter((t): t is string => !!t && t.length > 20)
      .join('\n\n');
  }

  // Fallback: find all substantial paragraphs
  if (!content || content.length < 200) {
    const allP = document.querySelectorAll('p');
    content = Array.from(allP)
      .map((p: Element) => (p as unknown as { textContent: string }).textContent?.trim())
      .filter((t): t is string => !!t && t.length > 30)
      .join('\n\n');
  }

  const word_count = content.split(/\s+/).filter(Boolean).length;

  return { title: title.trim(), author, date, content, word_count, url };
}

const extractArticle: DirectHandler = async (params) => {
  const targetUrl = params.url as string;
  const strategies = ['direct', 'google-cache', 'archive-org'] as const;

  for (const strategy of strategies) {
    try {
      let html: string;

      switch (strategy) {
        case 'direct':
          html = await fetchText(targetUrl, {
            headers: {
              'User-Agent': BROWSER_UA,
              Accept:
                'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            timeout: 12_000,
          });
          break;

        case 'google-cache':
          html = await fetchText(
            `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(targetUrl)}&strip=0`,
            {
              headers: { 'User-Agent': BROWSER_UA },
              timeout: 10_000,
            },
          );
          break;

        case 'archive-org': {
          const availability = await fetchJson<{
            archived_snapshots?: { closest?: { url: string; available: boolean } };
          }>(
            `https://archive.org/wayback/available?url=${encodeURIComponent(targetUrl)}`,
            { timeout: 5_000 },
          );
          const archiveUrl = availability.archived_snapshots?.closest?.url;
          if (!archiveUrl) continue;
          html = await fetchText(archiveUrl, { timeout: 12_000 });
          break;
        }
      }

      const parsed = await parseArticleFromHtml(html!, targetUrl);

      // Only accept if we got meaningful content
      if (parsed.content.length >= 100 && parsed.word_count >= 30) {
        const result: ExtractedArticle = {
          ...parsed,
          source_strategy: strategy,
        };
        if (params.include_html) {
          (result as unknown as Record<string, unknown>).html = html!;
        }
        return result;
      }
    } catch {
      // Strategy failed, try next
      continue;
    }
  }

  return {
    error: true,
    message: `Could not extract article content from ${targetUrl}. All strategies (direct, Google Cache, Archive.org) failed or returned insufficient content.`,
    url: targetUrl,
  };
};

const searchAndExtract: DirectHandler = async (params) => {
  const query = params.query as string;
  const maxArticles = Math.min((params.max_articles as number) || 3, 5);

  // Use GDELT DOC API to find articles
  const gdeltUrl = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  gdeltUrl.searchParams.set('query', query);
  gdeltUrl.searchParams.set('mode', 'ArtList');
  gdeltUrl.searchParams.set('maxrecords', String(maxArticles * 3));
  gdeltUrl.searchParams.set('format', 'json');
  gdeltUrl.searchParams.set('sort', 'DateDesc');

  const searchResults = await fetchJson<{
    articles?: { url: string; title: string; seendate: string; domain: string; socialimage: string }[];
  }>(gdeltUrl.toString());

  const articles = searchResults.articles || [];
  const extracted: ExtractedArticle[] = [];

  for (const article of articles) {
    if (extracted.length >= maxArticles) break;
    try {
      const result = await extractArticle({
        url: article.url,
      });
      if (result && !(result as Record<string, unknown>).error) {
        extracted.push(result as ExtractedArticle);
      }
    } catch {
      // Skip failed extractions
    }
  }

  return {
    query,
    search_results_found: articles.length,
    total_extracted: extracted.length,
    articles: extracted,
  };
};

export const articleHandlers: Record<string, DirectHandler> = {
  extract_article: extractArticle,
  search_and_extract: searchAndExtract,
};
