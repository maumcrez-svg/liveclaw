import type { Page } from 'puppeteer-core';
import type { GeneratedEpisode } from '../models/types';
import { playSegment, updateTicker, showEndCard, hideEndCard, playIntro } from './segment-player';
import { showMarketData } from './market-segment';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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

  // Hide end card if it was showing from a previous episode
  await hideEndCard(page);

  // Build audio lookup
  const audioMap = new Map(audioSegments.map((a) => [a.segmentId, a]));

  // Set initial ticker
  const firstTicker = script.segments.find((s) => s.tickerItems?.length)?.tickerItems;
  if (firstTicker) {
    await updateTicker(page, firstTicker);
  }

  // Play intro animation for new episodes
  if (showIntro) {
    console.log(`[EpisodeRunner] Playing intro animation (Episode #${episode.episodeNumber})`);
    await playIntro(page, episode.episodeNumber);
    await sleep(1000);
  } else {
    // Brief pause before starting (let FFmpeg/MediaMTX establish connection)
    await sleep(3000);
  }

  // Play each segment sequentially
  for (let i = 0; i < script.segments.length; i++) {
    const segment = script.segments[i];
    const audio = audioMap.get(segment.id) || null;

    console.log(`[EpisodeRunner] Segment ${i + 1}/${script.segments.length}: ${segment.type}`);

    // Inject market data visualization for market segments
    if (segment.type === 'market' && episode.plan?.marketSnapshot) {
      await showMarketData(page, episode.plan.marketSnapshot);
    }

    await playSegment(page, segment, audio);

    // Brief transition between segments
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
