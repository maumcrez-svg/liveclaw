import type { Page } from 'puppeteer-core';
import type { GeneratedEpisode, SegmentType } from '../models/types';
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

/** Map segment type to segment card template type */
function segmentToCardType(type: SegmentType): string | null {
  switch (type) {
    case 'social_pulse': return 'social';
    case 'builder_spotlight': return 'builder';
    case 'chain_radar': return 'onchain';
    case 'signal_analysis': return 'market';
    default: return null;
  }
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

  for (let i = 0; i < script.segments.length; i++) {
    const segment = script.segments[i];
    const audio = audioMap.get(segment.id) || null;

    console.log(`[EpisodeRunner] Segment ${i + 1}/${script.segments.length}: ${segment.type}`);

    // Segment transition flash
    await callWindow(page, '__segmentTransition', segment.type);
    await sleep(300);

    // Set host to speaking
    await callWindow(page, '__setBodyState', 'speaking_normal');

    // Show segment card in Zone B based on segment type
    const cardType = segmentToCardType(segment.type);
    if (cardType) {
      await showSegmentCard(page, cardType, segment);
    }

    // Chain radar: also inject market data into onchain card
    if (segment.type === 'chain_radar' && episode.plan?.marketSnapshot) {
      await showMarketData(page, episode.plan.marketSnapshot);
    }

    // Play the segment (audio + lower third)
    await playSegment(page, segment, audio);

    // Hide segment card after segment
    if (cardType) {
      await hideSegmentCard(page);
    }

    // Return to idle between segments
    await callWindow(page, '__setBodyState', 'idle_monitoring');

    if (i < script.segments.length - 1) {
      await sleep(400);
    }
  }

  if (!skipEndCard) {
    console.log('[EpisodeRunner] Showing end card...');
    await showEndCard(page);
    await sleep(30000);
  }

  console.log('[EpisodeRunner] Episode complete!');
}
