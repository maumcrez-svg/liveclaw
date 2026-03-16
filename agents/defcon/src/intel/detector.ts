import { bus, type IntelArticle } from '../orchestrator/events';
import * as store from './intel-store';

// Keywords that indicate high-priority intel
const HIGH_PRIORITY_KEYWORDS = [
  'attack', 'strike', 'missile', 'nuclear', 'enrichment', 'centrifuge',
  'bombing', 'airstrike', 'drone', 'UAV', 'IRGC', 'IDF', 'Hezbollah',
  'Houthi', 'escalation', 'retaliation', 'military operation', 'intercept',
  'iron dome', 'arrow', 'defense system', 'mobilization', 'invasion',
  'ceasefire', 'breakdown', 'DEFCON', 'nuclear weapon', 'warhead',
  'ballistic', 'cruise missile', 'F-35', 'carrier strike', 'strait of hormuz',
  'blockade', 'sanctions', 'IAEA', 'uranium', 'plutonium', 'Natanz',
  'Fordow', 'Isfahan', 'Tehran', 'Dimona', 'casualties', 'killed',
  'explosion', 'detonation', 'chemical', 'biological', 'WMD',
];

const LOW_PRIORITY_FILTER = [
  'sport', 'football', 'soccer', 'cricket', 'entertainment', 'celebrity',
  'recipe', 'weather forecast', 'horoscope', 'lottery',
];

// Per-type rate limiting
const lastNarrationTimes: Record<string, number> = {
  rss: 0,
  tweet: 0,
  gdelt: 0,
  flight: 0,
};
const RATE_LIMITS: Record<string, number> = {
  rss: 45_000,      // 45s between RSS narrations
  tweet: 30_000,    // 30s between tweet narrations
  gdelt: 60_000,    // 60s between GDELT narrations
  flight: 120_000,  // 2min between military flight narrations
};

// Medium-priority keywords (narrate at lower rate — 90s)
const MEDIUM_PRIORITY_KEYWORDS = [
  'ceasefire', 'sanctions', 'diplomacy', 'negotiations', 'humanitarian',
  'evacuation', 'refugees', 'peacekeepers', 'un resolution', 'nato', 'centcom',
];

export function shouldNarrate(article: IntelArticle): boolean {
  const title = article.title.toLowerCase();

  // Filter out low-priority noise
  if (LOW_PRIORITY_FILTER.some(kw => title.includes(kw))) {
    return false;
  }

  // Check if it matches high or medium-priority keywords
  const isHighPriority = HIGH_PRIORITY_KEYWORDS.some(kw => title.toLowerCase().includes(kw.toLowerCase()));
  const isMediumPriority = MEDIUM_PRIORITY_KEYWORDS.some(kw => title.includes(kw.toLowerCase()));
  if (!isHighPriority && !isMediumPriority) return false;

  // Rate limit check (per-type)
  const now = Date.now();
  const isTweet = article.source.includes('X/OSINT');
  const type = isTweet ? 'tweet' : 'rss';
  const rateLimit = RATE_LIMITS[type] || 60_000;
  const lastTime = lastNarrationTimes[type] || 0;

  // Medium-priority gets a longer rate limit
  const isMedium = !isHighPriority && MEDIUM_PRIORITY_KEYWORDS.some(kw => title.includes(kw.toLowerCase()));
  const effectiveLimit = isMedium ? 90_000 : rateLimit;

  if (now - lastTime < effectiveLimit) {
    console.log(`[Detector] Rate limited (${type}) — ${Math.round((effectiveLimit - (now - lastTime)) / 1000)}s remaining`);
    return false;
  }

  return true;
}

export function markNarrated(type: string = 'rss'): void {
  lastNarrationTimes[type] = Date.now();
}

export function shouldNarrateType(type: string): boolean {
  const now = Date.now();
  const rateLimit = RATE_LIMITS[type] || 60_000;
  const lastTime = lastNarrationTimes[type] || 0;
  return now - lastTime >= rateLimit;
}

export function processNewArticle(article: IntelArticle): void {
  const added = store.addItem({
    id: article.id,
    title: article.title,
    source: article.source,
    url: article.url,
    timestamp: article.timestamp,
    type: article.source.includes('AMK_Mapping') || article.source.includes('X/OSINT') ? 'tweet' : 'rss',
  });

  if (!added) return; // duplicate

  if (shouldNarrate(article)) {
    const isTweet = article.source.includes('AMK_Mapping') || article.source.includes('X/OSINT');
    bus.emit(isTweet ? 'intel:new-tweet' : 'intel:new-article', article);
    markNarrated(isTweet ? 'tweet' : 'rss');
    store.markNarrated(article.id);
  }
}
