import type { Page } from 'puppeteer-core';
import type { GeneratedEpisode, RawArticle, MarketSnapshot } from '../models/types';
import { NewsAccumulator } from '../accumulator/news-accumulator';
import { rankNews } from '../editorial/ranker';
import { writeScript } from '../editorial/scriptwriter';
import { synthesizeAllSegments } from '../voice/tts-engine';
import { runEpisode } from '../orchestrator/episode-runner';
import * as fs from 'fs';
import * as path from 'path';
import { createBridge } from '../idol-frame/index';

const EPISODE_COUNTER_FILE = path.join(__dirname, '..', '..', '.episode-counter');

function loadEpisodeNumber(): number {
  try {
    const raw = fs.readFileSync(EPISODE_COUNTER_FILE, 'utf-8').trim();
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num > 0) {
      console.log(`[Coordinator] Resumed episode counter from disk: ${num}`);
      return num;
    }
  } catch {}
  return 0;
}

function saveEpisodeNumber(num: number): void {
  try {
    fs.writeFileSync(EPISODE_COUNTER_FILE, String(num), 'utf-8');
  } catch (err) {
    console.error('[Coordinator] Failed to persist episode counter:', err);
  }
}

export class EpisodeCoordinator {
  private episodeNumber = loadEpisodeNumber();
  private lastEpisode: GeneratedEpisode | null = null;
  private nextEpisode: GeneratedEpisode | null = null;
  private preparing = false;
  private accumulator: NewsAccumulator;
  private idolFrame = createBridge();

  constructor(accumulator: NewsAccumulator) {
    this.accumulator = accumulator;
    console.log(`[Idol Frame] Bridge loaded — entity: ${this.idolFrame.getEntity().entity.name} (${this.idolFrame.getEntity().entity.id})`);
    const cont = this.idolFrame.getContinuityState();
    if (cont.episode_count > 0) {
      console.log(`[Idol Frame] Continuity loaded: ${cont.episode_count} episodes, ${cont.recent_opinions.length} opinions, ${cont.stories_covered.length} stories tracked`);
    }
  }

  async run(page: Page): Promise<void> {
    // First episode: do initial fetch and block until ready
    console.log('[Coordinator] Generating first episode (blocking)...');
    await this.accumulator.poll();

    // For the first episode, use whatever we have (don't wait for threshold)
    const firstEpisode = await this.generateEpisode();
    this.lastEpisode = firstEpisode;

    console.log(`[Coordinator] First episode ready — entering replay loop`);

    // Start background polling now
    this.accumulator.start();

    // Main replay loop — runs forever
    while (true) {
      // Check if a new episode was prepared in the background
      if (this.nextEpisode) {
        console.log(`[Coordinator] Swapping to Episode #${this.nextEpisode.episodeNumber}`);
        this.lastEpisode = this.nextEpisode;
        this.nextEpisode = null;
      }

      const isFirstPlay = this.lastEpisode === this.nextEpisode; // always false after swap, but check replay
      const isReplay = this.lastEpisode!.episodeNumber < this.episodeNumber || this.wasPlayedOnce(this.lastEpisode!);

      // Kick off next episode generation BEFORE playing (so it builds while this one airs)
      if (!this.preparing && this.accumulator.hasEnough()) {
        this.kickOffPreparation();
      }

      console.log(`[Coordinator] Playing Episode #${this.lastEpisode!.episodeNumber}${isReplay ? ' (replay)' : ''}`);

      await runEpisode(page, this.lastEpisode!, { skipEndCard: isReplay, showIntro: !isReplay });

      // Mark as played
      (this.lastEpisode as any).__played = true;
    }
  }

  private wasPlayedOnce(episode: GeneratedEpisode): boolean {
    return !!(episode as any).__played;
  }

  private kickOffPreparation(): void {
    this.preparing = true;
    console.log(`[Coordinator] Accumulator has ${this.accumulator.pendingCount()} articles — preparing next episode in background`);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Episode generation timed out (5 min)')), 5 * 60 * 1000),
    );

    Promise.race([this.generateEpisode(), timeout])
      .then((episode) => {
        this.nextEpisode = episode;
        this.preparing = false;
        console.log(`[Coordinator] Episode #${episode.episodeNumber} ready — will swap after current replay`);
      })
      .catch((err) => {
        console.error('[Coordinator] Failed to prepare episode:', err);
        this.preparing = false;
      });
  }

  private async generateEpisode(): Promise<GeneratedEpisode> {
    const num = this.episodeNumber + 1;
    const date = new Date().toISOString().slice(0, 10);

    console.log(`\n========== GENERATING EPISODE #${num} ==========\n`);

    // Flush articles from accumulator (does NOT mark as seen yet)
    const { articles, market } = this.accumulator.flush();

    if (articles.length === 0) {
      throw new Error('No articles available — cannot generate episode');
    }

    // Rank
    console.log(`[Coordinator] Ranking ${articles.length} articles...`);
    const plan = await rankNews(articles, market);

    // Mark only the selected articles as used
    const usedIds = new Set<string>();
    usedIds.add(plan.headline.articleId);
    for (const story of plan.stories) usedIds.add(story.articleId);
    this.accumulator.markUsed(usedIds);

    // Script (with episode number)
    console.log('[Coordinator] Writing script...');
    const script = await writeScript(plan, articles, num);

    // TTS
    console.log('[Coordinator] Synthesizing audio...');
    const audioSegments = await synthesizeAllSegments(
      script.segments.map((s) => ({ id: s.id, narration: s.narration })),
    );

    // Only increment after full success — failed generations don't consume episode numbers
    this.episodeNumber = num;
    saveEpisodeNumber(num);

    // Idol Frame: update continuity memory so Larry remembers this episode
    // Uses LLM to extract real opinions (async, non-blocking)
    try {
      await this.idolFrame.updateContinuityAsync({
        episodeNumber: num,
        segments: script.segments.map(s => ({
          narration: s.narration,
          headline: s.headline,
          type: s.type,
        })),
        articles: articles.map(a => ({ title: a.title, summary: a.summary })),
      });
    } catch (err) {
      console.error('[Idol Frame] Continuity update failed (non-fatal):', err);
    }

    console.log(`[Coordinator] Episode #${num} generated: ${script.segments.length} segments, ${audioSegments.length} audio files`);

    this.accumulator.resetStarvation();

    return { date, episodeNumber: num, articles, plan, script, audioSegments };
  }
}
