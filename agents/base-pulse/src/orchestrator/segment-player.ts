import type { Page } from 'puppeteer-core';
import type { Segment } from '../models/types';
import { setAvatarExpression } from '../avatar/avatar-controller';
import { playAndWait } from '../voice/speech-queue';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

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
      (type: string, headline: string, subheadline: string) => {
        (window as any).__setMainScreen?.(type, headline, subheadline);
      },
      segment.type,
      segment.headline,
      segment.subheadline || '',
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

export async function updateEcosystem(page: Page, data: Record<string, string>): Promise<void> {
  await safeEval(page, () =>
    page.evaluate((d: Record<string, string>) => {
      (window as any).__updateEcosystem?.(d);
    }, data),
  );
}

export async function pushSignal(page: Page, text: string, type: string = 'signal'): Promise<void> {
  // No-op — signal feed removed from new layout
}

export interface SignalCardData {
  username: string;
  displayName: string;
  text: string;
  platform?: string;
  signalType?: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  timestamp?: string;
}

/** Show a segment card in Zone B */
export async function showSegmentCard(page: Page, cardType: string, segment: Segment, preBuiltData?: Record<string, string>): Promise<void> {
  const data = preBuiltData || segment.cardData || buildCardData(cardType, segment);
  await safeEval(page, () =>
    page.evaluate(
      (type: string, d: Record<string, string>) => {
        (window as any).__showSegmentCard?.(type, d);
      },
      cardType,
      data,
    ),
  );
}

/** Build card data from segment info */
function buildCardData(cardType: string, segment: Segment): Record<string, string> {
  const headline = segment.headline || '';
  const sub = segment.subheadline || '';

  if (cardType === 'social') {
    const tweetMatch = headline.match(/^@(\w+):\s*(.+)/) || sub.match(/^@(\w+):\s*(.*)/);
    return {
      displayName: tweetMatch ? tweetMatch[1] : headline.slice(0, 30),
      username: tweetMatch ? tweetMatch[1] : 'signal',
      text: tweetMatch ? tweetMatch[2] : sub || headline,
      platform: headline.includes('Farcaster') ? 'farcaster' : 'twitter',
      signalType: 'builder',
    };
  }

  if (cardType === 'builder') {
    return {
      name: headline,
      tagline: sub,
      body: sub || headline,
      stage: 'LIVE',
      traction: 'early signal',
      layer: 'DeFi',
    };
  }

  if (cardType === 'onchain') {
    return {
      metric: headline.match(/\$[\d,.]+[BMK]?/)?.[0] || '--',
      label: headline.replace(/\$[\d,.]+[BMK]?/, '').trim(),
      change: '',
      context: sub || '',
      supporting: '',
    };
  }

  if (cardType === 'market') {
    const tokenMatch = headline.match(/^(\w+)\s/);
    const priceMatch = headline.match(/\$([\d,.]+)/);
    const changeMatch = headline.match(/([▲▼]\s*[\d.]+%)/);
    return {
      symbol: tokenMatch ? tokenMatch[1] : '',
      price: priceMatch ? `$${priceMatch[1]}` : '',
      change: changeMatch ? changeMatch[1] : '',
      analysis: sub || headline,
      ecosystemLink: '',
    };
  }

  return { text: headline };
}

/** Hide the current segment card */
export async function hideSegmentCard(page: Page): Promise<void> {
  await safeEval(page, () =>
    page.evaluate(() => {
      (window as any).__hideSegmentCard?.();
    }),
  );
}

// Legacy: kept for backward compat with old signal card system
export async function showSignalCard(page: Page, data: SignalCardData): Promise<void> {
  await safeEval(page, () =>
    page.evaluate((d: SignalCardData) => {
      (window as any).__showSignalCard?.(d);
    }, data),
  );
}

export async function hideSignalCard(page: Page): Promise<void> {
  await hideSegmentCard(page);
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

  await setAvatarExpression(segment.expression);
  await setMainScreen(page, segment);

  await showLowerThird(page, segment.headline, segment.subheadline);
  if (segment.tickerItems && segment.tickerItems.length > 0) {
    await updateTicker(page, segment.tickerItems);
  }

  if (audioData) {
    await playAndWait(audioData.audioBase64, audioData.format, audioData.durationEstMs);
  } else {
    await sleep(segment.estimatedDurationSec * 1000);
  }

  await sleep(200);
  await hideLowerThird(page);
}
