import type { Page } from 'puppeteer-core';

let page: Page;

export async function initBridge(puppeteerPage: Page): Promise<void> {
  page = puppeteerPage;

  // Expose a function for audio playback in the browser
  await page.exposeFunction('__playAudioReady', () => {
    console.log('[Bridge] Audio system ready');
  });

  console.log('[Bridge] Initialized');
}

export async function updateCommentary(text: string): Promise<void> {
  try {
    await page.evaluate((t: string) => {
      (window as any).__updateCommentary?.(t);
    }, text);
  } catch {
    // Ignore if page not ready
  }
}

export async function addTickerMessage(text: string): Promise<void> {
  try {
    await page.evaluate((t: string) => {
      (window as any).__addTickerMessage?.(t);
    }, text);
  } catch {
    // Ignore
  }
}

export async function updateObjective(text: string): Promise<void> {
  try {
    await page.evaluate((t: string) => {
      (window as any).__updateObjective?.(t);
    }, text);
  } catch {
    // Ignore
  }
}
