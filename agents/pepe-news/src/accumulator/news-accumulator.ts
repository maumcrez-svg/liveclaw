import { RSS_SOURCES } from '../ingest/sources';
import { fetchRssFeed } from '../ingest/rss-fetcher';
import { fetchMarketSnapshot } from '../ingest/coingecko';
import { config } from '../config';
import type { RawArticle, MarketSnapshot } from '../models/types';

const MAX_PENDING_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours — articles older than this get dropped
const MAX_SKIPS = 2; // if an article is offered to ranker 2 times and never picked, drop it

export class NewsAccumulator {
  private seenIds = new Set<string>();
  private seenTitles = new Set<string>();
  private pendingArticles: RawArticle[] = [];
  private skipCounts = new Map<string, number>(); // articleId → times offered but not selected
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
   * Returns pending articles for ranking after pruning stale/skipped ones.
   * After ranking, call markUsed() with the articles that were actually selected.
   */
  flush(): { articles: RawArticle[]; market: MarketSnapshot } {
    const now = Date.now();

    // Prune: drop articles that are too old or skipped too many times
    const before = this.pendingArticles.length;
    this.pendingArticles = this.pendingArticles.filter((a) => {
      const age = now - new Date(a.publishedAt).getTime();
      if (age > MAX_PENDING_AGE_MS) return false;
      const skips = this.skipCounts.get(a.id) || 0;
      if (skips >= MAX_SKIPS) {
        this.seenIds.add(a.id); // prevent re-fetching
        return false;
      }
      return true;
    });
    const pruned = before - this.pendingArticles.length;
    if (pruned > 0) {
      console.log(`[Accumulator] Pruned ${pruned} stale/skipped articles`);
    }

    // Increment skip count for all remaining articles (they're being offered again)
    for (const a of this.pendingArticles) {
      this.skipCounts.set(a.id, (this.skipCounts.get(a.id) || 0) + 1);
    }

    const articles = [...this.pendingArticles];
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
        this.skipCounts.delete(a.id);
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
