import type { RssSource } from './sources';
import type { RawArticle, NewsCategory } from '../models/types';
import crypto from 'crypto';

const CATEGORY_KEYWORDS: Record<NewsCategory, string[]> = {
  bitcoin: ['bitcoin', 'btc', 'satoshi', 'lightning network'],
  ethereum: ['ethereum', 'eth', 'vitalik', 'layer 2', 'l2', 'rollup'],
  altcoins: ['solana', 'sol', 'cardano', 'ada', 'polkadot', 'dot', 'avalanche', 'avax', 'bnb'],
  defi: ['defi', 'decentralized finance', 'liquidity', 'yield', 'tvl', 'lending', 'dex', 'amm', 'uniswap', 'aave'],
  regulation: ['sec', 'regulation', 'regulatory', 'lawsuit', 'court', 'congress', 'bill', 'compliance', 'ban'],
  exchange: ['binance', 'coinbase', 'kraken', 'exchange', 'okx', 'bybit'],
  hack: ['hack', 'exploit', 'breach', 'vulnerability', 'stolen', 'rug pull', 'rugpull', 'scam', 'phishing'],
  memecoins: ['memecoin', 'meme coin', 'doge', 'shib', 'pepe', 'bonk', 'wif'],
  macro: ['fed', 'federal reserve', 'interest rate', 'inflation', 'recession', 'gdp', 'cpi', 'treasury'],
};

function classifyCategory(title: string, summary: string): NewsCategory {
  const text = `${title} ${summary}`.toLowerCase();
  let bestCategory: NewsCategory = 'macro';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter((kw) => text.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category as NewsCategory;
    }
  }

  return bestCategory;
}

function extractTextContent(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRssXml(xml: string, sourceName: string): RawArticle[] {
  const articles: RawArticle[] = [];

  // Handle both RSS 2.0 (<item>) and Atom (<entry>) formats
  const isAtom = xml.includes('<entry>') || xml.includes('<entry ');
  const itemRegex = isAtom
    ? /<entry[\s>]([\s\S]*?)<\/entry>/gi
    : /<item>([\s\S]*?)<\/item>/gi;

  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];

    const titleMatch = item.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s);

    // Atom uses <link href="..."/> ; RSS uses <link>url</link>
    let url = '';
    const atomLinkMatch = item.match(/<link[^>]+href=["']([^"']+)["']/);
    const rssLinkMatch = item.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/s);
    if (atomLinkMatch) {
      url = atomLinkMatch[1];
    } else if (rssLinkMatch) {
      url = extractTextContent(rssLinkMatch[1]);
    }

    const descMatch = item.match(/<(?:description|summary|content)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content)>/s);

    // Atom uses <updated> or <published>; RSS uses <pubDate>
    const pubDateMatch = item.match(/<(?:pubDate|published|updated)>(.*?)<\/(?:pubDate|published|updated)>/s);

    if (!titleMatch || !url) continue;

    const title = extractTextContent(titleMatch[1]);
    const summary = descMatch ? extractTextContent(descMatch[1]).slice(0, 300) : '';
    const publishedAt = pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString();

    const id = crypto.createHash('md5').update(url).digest('hex').slice(0, 12);

    articles.push({
      id,
      title,
      summary,
      url,
      source: sourceName,
      publishedAt,
      category: classifyCategory(title, summary),
    });
  }

  return articles;
}

export async function fetchRssFeed(source: RssSource): Promise<RawArticle[]> {
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'PepeNews/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error(`[RSS] ${source.name} returned ${res.status}`);
      return [];
    }

    const xml = await res.text();
    const articles = parseRssXml(xml, source.name);
    console.log(`[RSS] ${source.name}: ${articles.length} articles`);
    return articles;
  } catch (err) {
    console.error(`[RSS] ${source.name} failed:`, err);
    return [];
  }
}
