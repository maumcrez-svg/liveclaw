import fs from 'fs';
import path from 'path';
import type { RawArticle, MarketSnapshot } from '../models/types';
import { BASE_RSS_SOURCES } from './sources';
import { fetchRssFeed } from './rss-fetcher';
import { fetchMarketSnapshot } from './coingecko';
import { fetchTwitterSignals } from './twitter-fetcher';
import { fetchOnchainData } from './basescan-fetcher';
import { fetchFarcasterSignals } from './farcaster-fetcher';

function deduplicateArticles(articles: RawArticle[]): RawArticle[] {
  const seen = new Set<string>();
  return articles.filter((a) => {
    if (seen.has(a.id)) return false;
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

/**
 * 5-layer ingest:
 * 1. RSS/Blogs (official + news)
 * 2. BaseScan/DeFiLlama (onchain)
 * 3. Farcaster (builder social)
 * 4. CoinGecko (market)
 * 5. Twitter/X (attention)
 */
export async function ingestNews(): Promise<{ articles: RawArticle[]; market: MarketSnapshot }> {
  console.log('[Ingest] Starting 5-layer Base ecosystem ingestion...');

  // Layer 1: RSS feeds
  const feedResults = await Promise.all(
    BASE_RSS_SOURCES.map((source) => fetchRssFeed(source)),
  );
  let allArticles = feedResults.flat();
  console.log(`[Ingest] Layer 1 (RSS): ${allArticles.length} articles`);

  // Layer 2: Onchain data (BaseScan + DeFiLlama)
  const onchainResult = await fetchOnchainData();
  allArticles.push(...onchainResult.articles);
  console.log(`[Ingest] Layer 2 (Onchain): ${onchainResult.articles.length} signals`);

  // Layer 3: Farcaster
  const farcasterArticles = await fetchFarcasterSignals();
  allArticles.push(...farcasterArticles);
  console.log(`[Ingest] Layer 3 (Farcaster): ${farcasterArticles.length} signals`);

  // Layer 4: Market data (fetched separately for snapshot)
  const market = await fetchMarketSnapshot();
  if (onchainResult.baseTvl) {
    market.baseTvl = onchainResult.baseTvl;
    market.baseTvlChange24h = onchainResult.baseTvlChange;
  }
  if (onchainResult.gasGwei !== undefined) market.baseGasGwei = onchainResult.gasGwei;
  if (onchainResult.blockNumber !== undefined) market.baseBlockNumber = onchainResult.blockNumber;
  console.log(`[Ingest] Layer 4 (Market): snapshot ready`);

  // Layer 5: Twitter/X
  const twitterArticles = await fetchTwitterSignals();
  allArticles.push(...twitterArticles);
  console.log(`[Ingest] Layer 5 (Twitter): ${twitterArticles.length} signals`);

  // Deduplicate across all layers
  const totalRaw = allArticles.length;
  allArticles = deduplicateArticles(allArticles);
  console.log(`[Ingest] After dedup: ${allArticles.length} (removed ${totalRaw - allArticles.length} dupes)`);

  // Filter to last 24h
  allArticles = filterRecent(allArticles, 24);
  console.log(`[Ingest] After time filter (24h): ${allArticles.length}`);

  // Sort by recency
  allArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

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
      if (market.baseTvl) console.log(`[Ingest] Base TVL: $${(market.baseTvl / 1e9).toFixed(2)}B`);
    })
    .catch((err) => {
      console.error('[Ingest] Fatal:', err);
      process.exit(1);
    });
}
