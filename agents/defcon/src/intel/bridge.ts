import type { Page } from 'puppeteer-core';
import { bus } from '../orchestrator/events';
import { processNewArticle } from './detector';
import * as store from './intel-store';

let bridgePage: Page;

export async function initBridge(page: Page): Promise<void> {
  bridgePage = page;

  // Expose Node functions to browser context
  await page.exposeFunction('__onNewArticle', (article: {
    id: string;
    title: string;
    source: string;
    url: string;
  }) => {
    console.log(`[Bridge] New article: [${article.source}] ${article.title.substring(0, 60)}...`);
    processNewArticle({
      id: article.id || `rss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: article.title,
      source: article.source,
      url: article.url || '',
      timestamp: Date.now(),
    });
  });

  await page.exposeFunction('__onDefconChange', (newLevel: number) => {
    const oldLevel = store.getDefconLevel();
    if (newLevel === oldLevel) return;
    console.log(`[Bridge] DEFCON change: ${oldLevel} → ${newLevel}`);
    const previousLevel = store.setDefconLevel(newLevel);
    bus.emit('intel:defcon-change', newLevel, previousLevel);
  });

  await page.exposeFunction('__onOsintUpdate', (count: number) => {
    bus.emit('intel:osint-update', count);
  });

  await page.exposeFunction('__onFlightCount', (count: number) => {
    store.setFlightCount(count);
    bus.emit('intel:flight-count', count);
  });

  await page.exposeFunction('__onMilitaryFlight', (flight: {
    callsign: string;
    type: string;
    lat: number;
    lon: number;
    alt: number;
    heading: number;
  }) => {
    console.log(`[Bridge] Military flight detected: ${flight.callsign} at ${flight.lat},${flight.lon}`);
    bus.emit('intel:military-flight', flight);
  });

  await page.exposeFunction('__onSeismicCount', (count: number) => {
    store.setSeismicCount(count);
    bus.emit('intel:seismic-count', count);
  });

  console.log('[Bridge] All functions exposed to browser');
}

export async function updateCommsPanel(mode: string, message: string): Promise<void> {
  try {
    await bridgePage.evaluate(
      (m: string, msg: string) => {
        (window as any).__updateComms?.(m, msg);
      },
      mode,
      message,
    );
  } catch (err) {
    console.error('[Bridge] Failed to update COMMS panel:', err);
  }
}

export async function triggerAlert(): Promise<void> {
  try {
    await bridgePage.evaluate(() => {
      (window as any).__triggerAlert?.();
    });
  } catch (err) {
    console.error('[Bridge] Failed to trigger alert:', err);
  }
}

export async function addIntelEntry(source: string, title: string, type: string): Promise<void> {
  try {
    await bridgePage.evaluate(
      (s: string, t: string, tp: string) => {
        (window as any).__addIntelEntry?.(s, t, tp);
      },
      source,
      title,
      type,
    );
  } catch (err) {
    console.error('[Bridge] Failed to add intel entry:', err);
  }
}
