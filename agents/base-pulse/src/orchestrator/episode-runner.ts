import type { Page } from 'puppeteer-core';
import type { GeneratedEpisode, RawArticle, Segment, SegmentType } from '../models/types';
import { playSegment, updateTicker, showEndCard, hideEndCard, playIntro, updateEcosystem, showSegmentCard, hideSegmentCard } from './segment-player';
import { showMarketData } from './market-segment';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Call a window function safely */
async function callWindow(page: Page, fn: string, ...args: any[]): Promise<void> {
  try {
    await page.evaluate((f: string, a: any[]) => {
      const func = (window as any)[f];
      if (func) func(...a);
    }, fn, args);
  } catch {}
}

/** Map segment type to segment card template type — every segment gets a card */
function segmentToCardType(type: SegmentType): string {
  switch (type) {
    case 'social_pulse': return 'social';
    case 'builder_spotlight': return 'social';
    case 'signal_analysis': return 'social';
    case 'opening': return 'social';
    case 'closing': return 'social';
    default: return 'social';
  }
}

/** Find the best matching article for a segment */
function findMatchingArticle(segment: Segment, articles: RawArticle[]): RawArticle | undefined {
  const headline = segment.headline.toLowerCase();
  const narration = segment.narration.toLowerCase();

  // Try matching by headline content
  for (const article of articles) {
    const title = article.title.toLowerCase();
    const summary = article.summary.toLowerCase();
    // Check if segment headline contains key words from article title
    if (title.length > 10 && headline.includes(title.slice(0, 30))) return article;
    // Check if article title words appear in the narration
    const titleWords = title.split(/\s+/).filter(w => w.length > 4);
    const matchCount = titleWords.filter(w => narration.includes(w)).length;
    if (titleWords.length > 0 && matchCount >= Math.ceil(titleWords.length * 0.5)) return article;
  }

  return undefined;
}

/** Build rich tweet card data from an article */
function buildTweetCardData(article: RawArticle): Record<string, string> {
  // Source format is typically "Twitter/@username"
  const sourceMatch = article.source.match(/@(\w+)/);
  const username = sourceMatch ? sourceMatch[1] : 'base';
  // Display name: capitalize username as fallback
  const displayName = username.charAt(0).toUpperCase() + username.slice(1);

  return {
    displayName,
    username,
    text: article.summary || article.title,
    platform: 'twitter',
    signalType: article.signalType || 'culture',
  };
}

/** Build a fallback card from segment data */
function buildFallbackCardData(segment: Segment): Record<string, string> {
  // Try to extract @username from narration or headline
  const mentionMatch = segment.narration.match(/@(\w+)/) || segment.headline.match(/@(\w+)/);
  const username = mentionMatch ? mentionMatch[1] : 'basepulse';
  const displayName = username.charAt(0).toUpperCase() + username.slice(1);

  return {
    displayName,
    username,
    text: segment.headline,
    platform: 'twitter',
    signalType: 'culture',
  };
}

export interface RunEpisodeOptions {
  skipEndCard?: boolean;
  showIntro?: boolean;
}

export async function runEpisode(
  page: Page,
  episode: GeneratedEpisode,
  options: RunEpisodeOptions = {},
): Promise<void> {
  const { script, audioSegments } = episode;
  const { skipEndCard = false, showIntro = false } = options;

  console.log(`[EpisodeRunner] Starting episode: ${script.date}`);
  console.log(`[EpisodeRunner] ${script.segments.length} segments, ~${script.totalEstimatedDurationSec}s`);

  await hideEndCard(page);

  const audioMap = new Map(audioSegments.map((a) => [a.segmentId, a]));

  const firstTicker = script.segments.find((s) => s.tickerItems?.length)?.tickerItems;
  if (firstTicker) {
    await updateTicker(page, firstTicker);
  }

  // Push live ecosystem data to left rail
  if (episode.plan?.marketSnapshot) {
    const m = episode.plan.marketSnapshot;
    await updateEcosystem(page, {
      baseTvl: m.baseTvl ? `$${(m.baseTvl / 1e9).toFixed(2)}B` : '--',
      ethPrice: m.ethPrice ? `$${m.ethPrice.toLocaleString()}` : '--',
      gas: m.baseGasGwei !== undefined ? (m.baseGasGwei < 0.01 ? '< 0.01 gwei' : `${m.baseGasGwei.toFixed(4)} gwei`) : '--',
      blockNumber: m.baseBlockNumber ? m.baseBlockNumber.toLocaleString() : '--',
      dailyTxn: '--',
    });
  }

  if (showIntro) {
    console.log(`[EpisodeRunner] Playing intro animation (Episode #${episode.episodeNumber})`);
    await playIntro(page, episode.episodeNumber);
    await sleep(1000);
  } else {
    await sleep(3000);
  }

  // Pre-build card data for all segments by matching to original articles
  const headlineArticle = episode.articles.find(a => a.id === episode.plan?.headline?.articleId);

  for (let i = 0; i < script.segments.length; i++) {
    const segment = script.segments[i];
    const audio = audioMap.get(segment.id) || null;

    console.log(`[EpisodeRunner] Segment ${i + 1}/${script.segments.length}: ${segment.type}`);

    // Segment transition flash
    await callWindow(page, '__segmentTransition', segment.type);
    await sleep(300);

    // Set host to speaking
    await callWindow(page, '__setBodyState', 'speaking_normal');

    // Build rich card data — every segment gets a card, no empty center stage
    const cardType = segmentToCardType(segment.type);
    let cardData: Record<string, string>;

    if (segment.cardData) {
      // Pre-built card data from upstream
      cardData = segment.cardData;
    } else if (cardType === 'onchain') {
      // Onchain card uses default buildCardData from segment-player
      cardData = {};
    } else {
      // Try to find matching article for rich tweet data
      const matchedArticle = findMatchingArticle(segment, episode.articles);
      if (matchedArticle) {
        cardData = buildTweetCardData(matchedArticle);
      } else if (headlineArticle && (segment.type === 'opening' || segment.type === 'closing')) {
        // Opening/closing: use headline tweet
        cardData = buildTweetCardData(headlineArticle);
      } else {
        // Fallback: extract what we can from segment text
        cardData = buildFallbackCardData(segment);
      }
    }

    // Show segment card — always visible
    if (cardType === 'onchain' && Object.keys(cardData).length === 0) {
      await showSegmentCard(page, cardType, segment);
    } else {
      await showSegmentCard(page, cardType, segment, cardData);
    }

    // Play the segment (audio + lower third)
    await playSegment(page, segment, audio);

    // Hide segment card after segment
    await hideSegmentCard(page);

    // Return to idle between segments
    await callWindow(page, '__setBodyState', 'idle_monitoring');

    if (i < script.segments.length - 1) {
      const nextSeg = script.segments[i + 1];
      // Breathing room between segments — Vespolak needs to pause and think
      const isCurrentSerious = segment.estimatedDurationSec > 30;
      const isNextOpening = nextSeg?.type === 'opening';
      const isClosing = segment.type === 'closing';

      if (isClosing) {
        await sleep(200); // Quick transition to end
      } else if (isCurrentSerious) {
        // After a deep tweet read, give Vespolak a moment to "think" before next
        await callWindow(page, '__setBodyState', 'reacting');
        await sleep(2000);
        await callWindow(page, '__setBodyState', 'idle_monitoring');
        await sleep(1000);
      } else {
        // Quick tweet — shorter pause but still breathe
        await sleep(1500);
      }
    }
  }

  if (!skipEndCard) {
    console.log('[EpisodeRunner] Showing end card...');
    await showEndCard(page);
    await sleep(30000);
  }

  console.log('[EpisodeRunner] Episode complete!');
}
