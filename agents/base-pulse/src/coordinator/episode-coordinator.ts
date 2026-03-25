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

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..');
const EPISODE_COUNTER_FILE = path.join(DATA_DIR, '.episode-counter');

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
    console.log('[Coordinator] Generating first episode (blocking)...');
    await this.accumulator.poll();

    // Keep trying until we get a first episode
    while (!this.lastEpisode) {
      try {
        this.lastEpisode = await this.generateEpisode();
      } catch (err: any) {
        if (err.message === 'NO_SIGNALS_RETRY') {
          console.log('[Coordinator] No signals yet — waiting 60s and polling again...');
          await new Promise(r => setTimeout(r, 60000));
          await this.accumulator.poll();
          continue;
        }
        throw err;
      }
    }

    console.log(`[Coordinator] First episode ready — entering replay loop`);

    this.accumulator.start();

    while (true) {
      if (this.nextEpisode) {
        console.log(`[Coordinator] Swapping to Episode #${this.nextEpisode.episodeNumber}`);
        this.lastEpisode = this.nextEpisode;
        this.nextEpisode = null;
      }

      const isReplay = this.lastEpisode!.episodeNumber < this.episodeNumber || this.wasPlayedOnce(this.lastEpisode!);

      if (!this.preparing && this.accumulator.hasEnough()) {
        this.kickOffPreparation();
      }

      console.log(`[Coordinator] Playing Episode #${this.lastEpisode!.episodeNumber}${isReplay ? ' (replay)' : ''}`);

      await runEpisode(page, this.lastEpisode!, { skipEndCard: isReplay, showIntro: !isReplay });

      (this.lastEpisode as any).__played = true;

      // If no next episode and nothing preparing, poll aggressively
      if (!this.nextEpisode && !this.preparing) {
        console.log('[Coordinator] No next episode queued — polling for fresh signals...');
        await this.accumulator.poll();
        // If still not enough, wait 60s and poll again (don't wait for 5-min timer)
        if (!this.accumulator.hasEnough()) {
          console.log(`[Coordinator] Only ${this.accumulator.pendingCount()} signals — waiting 60s before retry`);
          await new Promise(r => setTimeout(r, 60000));
          await this.accumulator.poll();
        }
        if (this.accumulator.hasEnough()) {
          this.kickOffPreparation();
        }
      }
    }
  }

  private wasPlayedOnce(episode: GeneratedEpisode): boolean {
    return !!(episode as any).__played;
  }

  private kickOffPreparation(): void {
    this.preparing = true;
    console.log(`[Coordinator] Accumulator has ${this.accumulator.pendingCount()} signals — preparing next episode in background`);

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

    const { articles, market } = this.accumulator.flush();

    if (articles.length === 0) {
      console.log('[Coordinator] No new signals — will retry after next poll');
      // Don't crash — return a lightweight filler episode
      // The coordinator will keep replaying the last episode until new data arrives
      throw new Error('NO_SIGNALS_RETRY');
    }

    console.log(`[Coordinator] Ranking ${articles.length} signals...`);
    const plan = await rankNews(articles, market);

    const usedIds = new Set<string>();
    usedIds.add(plan.headline.articleId);
    for (const story of plan.stories) usedIds.add(story.articleId);
    this.accumulator.markUsed(usedIds);

    console.log('[Coordinator] Writing script...');
    const script = await writeScript(plan, articles, num);

    console.log('[Coordinator] Synthesizing audio...');
    const audioSegments = await synthesizeAllSegments(
      script.segments.map((s) => ({ id: s.id, narration: s.narration })),
    );

    this.episodeNumber = num;
    saveEpisodeNumber(num);

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
