import type { Page } from 'puppeteer-core';
import type { Segment } from '../models/types';
import { setAvatarExpression } from '../avatar/avatar-controller';
import { playAndWait } from '../voice/speech-queue';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Safe wrapper — if page/frame is detached, log and continue instead of crashing */
async function safeEval(page: Page, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err: any) {
    if (err.message?.includes('detached') || err.message?.includes('destroyed')) {
      console.error('[Segment] Page detached, skipping evaluate');
    } else {
      throw err;
    }
  }
}

export async function showLowerThird(
  page: Page,
  headline: string,
  subheadline?: string,
): Promise<void> {
  await safeEval(page, () =>
    page.evaluate(
      (h: string, sub: string) => {
        (window as any).__showLowerThird?.(h, sub);
      },
      headline,
      subheadline || '',
    ),
  );
}

export async function hideLowerThird(page: Page): Promise<void> {
  await safeEval(page, () =>
    page.evaluate(() => {
      (window as any).__hideLowerThird?.();
    }),
  );
}

export async function setMainScreen(page: Page, segment: Segment): Promise<void> {
  await safeEval(page, () =>
    page.evaluate(
      (type: string, headline: string, subheadline: string, visualCue: string) => {
        (window as any).__setMainScreen?.(type, headline, subheadline, visualCue);
      },
      segment.type,
      segment.headline,
      segment.subheadline || '',
      segment.visualCue,
    ),
  );
}

export async function updateTicker(page: Page, items: string[]): Promise<void> {
  await safeEval(page, () =>
    page.evaluate((tickerItems: string[]) => {
      (window as any).__updateTicker?.(tickerItems);
    }, items),
  );
}

export async function showEndCard(page: Page): Promise<void> {
  await safeEval(page, () =>
    page.evaluate(() => {
      (window as any).__showEndCard?.();
    }),
  );
}

export async function hideEndCard(page: Page): Promise<void> {
  await safeEval(page, () =>
    page.evaluate(() => {
      (window as any).__hideEndCard?.();
    }),
  );
}

export async function playIntro(page: Page, episodeNumber: number): Promise<void> {
  await safeEval(page, () =>
    page.evaluate((epNum: number) => {
      return (window as any).__playIntro?.(epNum);
    }, episodeNumber),
  );
}

export async function playSegment(
  page: Page,
  segment: Segment,
  audioData: { audioBase64: string; format: string; durationEstMs: number } | null,
): Promise<void> {
  console.log(`[Segment] Playing: [${segment.type}] ${segment.headline}`);

  // 1. Set avatar expression + update main screen simultaneously
  await setAvatarExpression(segment.expression);
  await setMainScreen(page, segment);

  // 2. Show lower third + update ticker
  await showLowerThird(page, segment.headline, segment.subheadline);
  if (segment.tickerItems && segment.tickerItems.length > 0) {
    await updateTicker(page, segment.tickerItems);
  }

  // 3. Play TTS audio and wait
  if (audioData) {
    await playAndWait(audioData.audioBase64, audioData.format, audioData.durationEstMs);
  } else {
    await sleep(segment.estimatedDurationSec * 1000);
  }

  // 4. Hide lower third for transition
  await sleep(200);
  await hideLowerThird(page);
}
