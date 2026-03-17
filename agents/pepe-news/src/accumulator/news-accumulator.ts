import { RSS_SOURCES } from '../ingest/sources';
import { fetchRssFeed } from '../ingest/rss-fetcher';
import { fetchMarketSnapshot } from '../ingest/coingecko';
import { config } from '../config';
import type { RawArticle, MarketSnapshot } from '../models/types';

const MAX_QUEUE_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours in queue — articles sitting this long get dropped
const MAX_SKIPS = 2; // if an article is offered to ranker 2 times and never picked, drop it
const SEEN_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — forget seen articles so they can be re-covered with fresh angle
const STARVATION_THRESHOLD = 3; // after 3 polls with 0 new articles, lower threshold to generate with what we have
const STARVATION_MIN_ARTICLES = 3; // minimum articles needed even in starvation mode

export class NewsAccumulator {
  private seenIds = new Map<string, number>(); // articleId → timestamp when marked seen
  private seenTitles = new Map<string, number>(); // normalizedTitle → timestamp
  private pendingArticles: RawArticle[] = [];
  private queuedAt = new Map<string, number>(); // articleId → timestamp when added to queue
  private skipCounts = new Map<string, number>(); // articleId → times offered but not selected
  private timer: ReturnType<typeof setInterval> | null = null;
  private latestMarket: MarketSnapshot | null = null;
  private zeroNewPolls = 0; // consecutive polls with 0 new articles

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

    // Expire old seen entries so articles can resurface with fresh angles
    const now = Date.now();
    let expired = 0;
    for (const [id, ts] of this.seenIds) {
      if (now - ts > SEEN_TTL_MS) { this.seenIds.delete(id); expired++; }
    }
    for (const [title, ts] of this.seenTitles) {
      if (now - ts > SEEN_TTL_MS) this.seenTitles.delete(title);
    }
    if (expired > 0) {
      console.log(`[Accumulator] Expired ${expired} seen articles (seen: ${this.seenIds.size})`);
    }

    const feedResults = await Promise.all(
      RSS_SOURCES.map((source) => fetchRssFeed(source)),
    );

    let newCount = 0;
    for (const article of feedResults.flat()) {
      if (this.isDuplicate(article)) continue;
      // Also check if already in pending (avoid duplicates within pending)
      if (this.pendingArticles.some((p) => p.id === article.id)) continue;
      this.pendingArticles.push(article);
      this.queuedAt.set(article.id, now);
      newCount++;
    }

    // Also refresh market data
    this.latestMarket = await fetchMarketSnapshot();

    // Track starvation
    if (newCount === 0) {
      this.zeroNewPolls++;
    } else {
      this.zeroNewPolls = 0;
    }

    console.log(`[Accumulator] +${newCount} new articles (pending: ${this.pendingArticles.length}, seen: ${this.seenIds.size}, starvation: ${this.zeroNewPolls})`);
  }

  hasEnough(): boolean {
    // In starvation mode, accept fewer articles to avoid infinite replay
    if (this.zeroNewPolls >= STARVATION_THRESHOLD && this.pendingArticles.length >= STARVATION_MIN_ARTICLES) {
      console.log(`[Accumulator] Starvation mode: ${this.pendingArticles.length} articles (threshold lowered from ${config.articleThreshold} to ${STARVATION_MIN_ARTICLES})`);
      return true;
    }
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
      const queueAge = now - (this.queuedAt.get(a.id) || now);
      if (queueAge > MAX_QUEUE_AGE_MS) return false;
      const skips = this.skipCounts.get(a.id) || 0;
      if (skips >= MAX_SKIPS) {
        this.seenIds.set(a.id, Date.now()); // prevent re-fetching
        this.queuedAt.delete(a.id);
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
        this.seenIds.set(a.id, Date.now());
        this.skipCounts.delete(a.id);
        this.queuedAt.delete(a.id);
        const normalized = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
        this.seenTitles.set(normalized, Date.now());
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

  /** Reset starvation counter (called externally after successful episode generation) */
  resetStarvation(): void {
    this.zeroNewPolls = 0;
  }
}
