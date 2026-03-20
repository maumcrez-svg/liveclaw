import type { Page } from 'puppeteer-core';

let page: Page;

export function initSpeechQueue(puppeteerPage: Page): void {
  page = puppeteerPage;
}

/** Play audio in the browser and wait for it to finish. Returns actual duration. */
export async function playAndWait(audioBase64: string, format: string, estimatedMs: number): Promise<void> {
  try {
    await page.evaluate(
      (b64: string, fmt: string) => {
        return (window as any).__playAudio(b64, fmt);
      },
      audioBase64,
      format,
    );
  } catch (err) {
    console.error('[Speech] Playback error:', err);
    await sleep(estimatedMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
