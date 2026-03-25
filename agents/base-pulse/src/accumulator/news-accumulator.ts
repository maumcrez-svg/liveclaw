import { fetchMarketSnapshot } from '../ingest/coingecko';
import { fetchOnchainData } from '../ingest/basescan-fetcher';
import { fetchTwitterSignals } from '../ingest/twitter-fetcher';
import { config } from '../config';
import type { RawArticle, MarketSnapshot } from '../models/types';
import * as fs from 'fs';
import * as path from 'path';

const MAX_QUEUE_AGE_MS = 4 * 60 * 60 * 1000;
const MAX_SKIPS = 3;
const SEEN_TTL_MS = 12 * 60 * 60 * 1000; // 12h — prevent tweet repetition across episodes
const STARVATION_THRESHOLD = 2;
const STARVATION_MIN_ARTICLES = 2;
const MAX_ARTICLE_AGE_MS = 48 * 60 * 60 * 1000; // 48h — wider window to avoid starvation
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..');
const SEEN_CACHE_FILE = path.join(DATA_DIR, '.seen-articles.json');

export class NewsAccumulator {
  private seenIds = new Map<string, number>();
  private seenTitles = new Map<string, number>();
  private pendingArticles: RawArticle[] = [];
  private queuedAt = new Map<string, number>();
  private skipCounts = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private latestMarket: MarketSnapshot | null = null;
  private zeroNewPolls = 0;

  constructor() {
    this.loadSeenCache();
  }

  private loadSeenCache(): void {
    try {
      const raw = fs.readFileSync(SEEN_CACHE_FILE, 'utf-8');
      const data = JSON.parse(raw) as { ids: [string, number][]; titles: [string, number][] };
      const now = Date.now();
      let loaded = 0;
      for (const [id, ts] of data.ids) {
        if (now - ts < SEEN_TTL_MS) { this.seenIds.set(id, ts); loaded++; }
      }
      for (const [title, ts] of data.titles) {
        if (now - ts < SEEN_TTL_MS) this.seenTitles.set(title, ts);
      }
      console.log(`[Accumulator] Loaded ${loaded} seen articles from disk (expired ${data.ids.length - loaded})`);
    } catch {
      // No cache file yet
    }
  }

  private saveSeenCache(): void {
    try {
      const data = {
        ids: [...this.seenIds.entries()],
        titles: [...this.seenTitles.entries()],
      };
      fs.writeFileSync(SEEN_CACHE_FILE, JSON.stringify(data), 'utf-8');
    } catch (err) {
      console.error('[Accumulator] Failed to save seen cache:', err);
    }
  }

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
    console.log('[Accumulator] Polling Twitter + onchain + market...');

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

    // Fetch Twitter + onchain in parallel
    const [onchainResult, twitterArticles] = await Promise.all([
      fetchOnchainData(),
      fetchTwitterSignals(),
    ]);

    const allFetched = [
      ...onchainResult.articles,
      ...twitterArticles,
    ];

    let newCount = 0;
    let tooOld = 0;
    for (const article of allFetched) {
      const articleAge = now - new Date(article.publishedAt).getTime();
      if (articleAge > MAX_ARTICLE_AGE_MS) { tooOld++; continue; }
      if (this.isDuplicate(article)) continue;
      if (this.pendingArticles.some((p) => p.id === article.id)) continue;
      this.pendingArticles.push(article);
      this.queuedAt.set(article.id, now);
      newCount++;
    }

    // Refresh market data
    this.latestMarket = await fetchMarketSnapshot();
    if (onchainResult.baseTvl) {
      this.latestMarket.baseTvl = onchainResult.baseTvl;
      this.latestMarket.baseTvlChange24h = onchainResult.baseTvlChange;
    }
    if (onchainResult.gasGwei !== undefined) this.latestMarket.baseGasGwei = onchainResult.gasGwei;
    if (onchainResult.blockNumber !== undefined) this.latestMarket.baseBlockNumber = onchainResult.blockNumber;

    if (newCount === 0) {
      this.zeroNewPolls++;
    } else {
      this.zeroNewPolls = 0;
    }

    console.log(`[Accumulator] +${newCount} new signals, ${tooOld} too old (pending: ${this.pendingArticles.length}, seen: ${this.seenIds.size}, starvation: ${this.zeroNewPolls})`);
  }

  hasEnough(): boolean {
    if (this.zeroNewPolls >= STARVATION_THRESHOLD && this.pendingArticles.length >= STARVATION_MIN_ARTICLES) {
      console.log(`[Accumulator] Starvation mode: ${this.pendingArticles.length} articles (threshold lowered from ${config.articleThreshold} to ${STARVATION_MIN_ARTICLES})`);
      return true;
    }
    return this.pendingArticles.length >= config.articleThreshold;
  }

  pendingCount(): number {
    return this.pendingArticles.length;
  }

  flush(): { articles: RawArticle[]; market: MarketSnapshot } {
    const now = Date.now();

    const before = this.pendingArticles.length;
    this.pendingArticles = this.pendingArticles.filter((a) => {
      const queueAge = now - (this.queuedAt.get(a.id) || now);
      if (queueAge > MAX_QUEUE_AGE_MS) return false;
      const skips = this.skipCounts.get(a.id) || 0;
      if (skips >= MAX_SKIPS) {
        this.seenIds.set(a.id, Date.now());
        this.queuedAt.delete(a.id);
        return false;
      }
      return true;
    });
    const pruned = before - this.pendingArticles.length;
    if (pruned > 0) {
      console.log(`[Accumulator] Pruned ${pruned} stale/skipped articles`);
    }

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
    this.saveSeenCache();
  }

  private isDuplicate(article: RawArticle): boolean {
    if (this.seenIds.has(article.id)) return true;
    const normalized = article.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
    if (this.seenTitles.has(normalized)) return true;
    return false;
  }

  resetStarvation(): void {
    this.zeroNewPolls = 0;
  }
}
