import { RSS_SOURCES } from '../ingest/sources';
import { fetchRssFeed } from '../ingest/rss-fetcher';
import { fetchMarketSnapshot } from '../ingest/coingecko';
import { config } from '../config';
import type { RawArticle, MarketSnapshot } from '../models/types';

export class NewsAccumulator {
  private seenIds = new Set<string>();
  private seenTitles = new Set<string>();
  private pendingArticles: RawArticle[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private latestMarket: MarketSnapshot | null = null;

  start(): void {
    console.log(`[Accumulator] Starting — polling every ${config.accumulatorPollMs / 1000}s, threshold: ${config.articleThreshold} articles`);
    this.timer = setInterval(() => {
      this.poll().catch((err) => console.error('[Accumulator] Poll error:', err));
    }, config.accumulatorPollMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async poll(): Promise<void> {
    console.log('[Accumulator] Polling RSS feeds...');

    const feedResults = await Promise.all(
      RSS_SOURCES.map((source) => fetchRssFeed(source)),
    );

    let newCount = 0;
    for (const article of feedResults.flat()) {
      if (this.isDuplicate(article)) continue;
      // Also check if already in pending (avoid duplicates within pending)
      if (this.pendingArticles.some((p) => p.id === article.id)) continue;
      this.pendingArticles.push(article);
      newCount++;
    }

    // Also refresh market data
    this.latestMarket = await fetchMarketSnapshot();

    console.log(`[Accumulator] +${newCount} new articles (pending: ${this.pendingArticles.length}, seen: ${this.seenIds.size})`);
  }

  hasEnough(): boolean {
    return this.pendingArticles.length >= config.articleThreshold;
  }

  pendingCount(): number {
    return this.pendingArticles.length;
  }

  /**
   * Returns all pending articles for ranking. Does NOT mark them as seen.
   * After ranking, call markUsed() with the articles that were actually selected.
   */
  flush(): { articles: RawArticle[]; market: MarketSnapshot } {
    const articles = [...this.pendingArticles];

    // Sort by recency
    articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    const market = this.latestMarket || {
      btcPrice: 0, btcChange24h: 0,
      ethPrice: 0, ethChange24h: 0,
      topMovers: [],
    };

    console.log(`[Accumulator] Flushed ${articles.length} articles for ranking`);
    return { articles, market };
  }

  /**
   * Mark specific articles as used (they were selected for an episode).
   * Removes them from pending and adds to seen sets so they won't appear again.
   */
  markUsed(usedIds: Set<string>): void {
    let removedCount = 0;
    this.pendingArticles = this.pendingArticles.filter((a) => {
      if (usedIds.has(a.id)) {
        this.seenIds.add(a.id);
        const normalized = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
        this.seenTitles.add(normalized);
        removedCount++;
        return false;
      }
      return true;
    });
    console.log(`[Accumulator] Marked ${removedCount} articles as used (pending: ${this.pendingArticles.length}, seen: ${this.seenIds.size})`);
  }

  private isDuplicate(article: RawArticle): boolean {
    if (this.seenIds.has(article.id)) return true;
    const normalized = article.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
    if (this.seenTitles.has(normalized)) return true;
    return false;
  }
}
