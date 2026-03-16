import fs from 'fs';
import path from 'path';
import type { RawArticle, MarketSnapshot } from '../models/types';
import { RSS_SOURCES } from './sources';
import { fetchRssFeed } from './rss-fetcher';
import { fetchMarketSnapshot } from './coingecko';

function deduplicateArticles(articles: RawArticle[]): RawArticle[] {
  const seen = new Set<string>();
  return articles.filter((a) => {
    if (seen.has(a.id)) return false;
    // Also check for very similar titles
    const normalizedTitle = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
    if (seen.has(normalizedTitle)) return false;
    seen.add(a.id);
    seen.add(normalizedTitle);
    return true;
  });
}

function filterRecent(articles: RawArticle[], hoursAgo = 24): RawArticle[] {
  const cutoff = Date.now() - hoursAgo * 60 * 60 * 1000;
  return articles.filter((a) => {
    const pubTime = new Date(a.publishedAt).getTime();
    return pubTime > cutoff;
  });
}

export async function ingestNews(): Promise<{ articles: RawArticle[]; market: MarketSnapshot }> {
  console.log('[Ingest] Starting news ingestion...');

  // Fetch all RSS feeds in parallel
  const feedResults = await Promise.all(
    RSS_SOURCES.map((source) => fetchRssFeed(source)),
  );

  let allArticles = feedResults.flat();
  console.log(`[Ingest] Total raw articles: ${allArticles.length}`);

  // Deduplicate
  allArticles = deduplicateArticles(allArticles);
  console.log(`[Ingest] After dedup: ${allArticles.length}`);

  // Filter to last 24h
  allArticles = filterRecent(allArticles, 24);
  console.log(`[Ingest] After time filter (24h): ${allArticles.length}`);

  // Sort by recency
  allArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  // Fetch market data
  const market = await fetchMarketSnapshot();

  return { articles: allArticles, market };
}

function getOutputDir(): string {
  const date = new Date().toISOString().slice(0, 10);
  const dir = path.join(__dirname, '..', '..', 'output', date);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// CLI entry point
if (require.main === module) {
  ingestNews()
    .then(({ articles, market }) => {
      const dir = getOutputDir();
      fs.writeFileSync(path.join(dir, 'raw_articles.json'), JSON.stringify(articles, null, 2));
      fs.writeFileSync(path.join(dir, 'market_snapshot.json'), JSON.stringify(market, null, 2));
      console.log(`[Ingest] Saved ${articles.length} articles to ${dir}`);
      console.log(`[Ingest] Market: BTC $${market.btcPrice.toLocaleString()}, ETH $${market.ethPrice.toLocaleString()}`);
    })
    .catch((err) => {
      console.error('[Ingest] Fatal:', err);
      process.exit(1);
    });
}
