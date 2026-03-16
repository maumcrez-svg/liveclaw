import type { Page } from 'puppeteer-core';
import { MODE_CONFIGS, type ModeConfig } from './generative';

export async function transitionToMode(
  page: Page,
  mode: string,
  overrides: Partial<ModeConfig> = {},
): Promise<void> {
  const cfg = MODE_CONFIGS[mode] || MODE_CONFIGS['flow-field'];
  const params = { ...cfg, ...overrides };

  await page.evaluate((p) => {
    Object.assign((window as any).__artisan, p);
  }, params);

  console.log(`[Transition] Switched to ${mode}`);
}

export async function updateVisualParams(
  page: Page,
  params: Record<string, unknown>,
): Promise<void> {
  await page.evaluate((p) => {
    Object.assign((window as any).__artisan, p);
  }, params);
}
