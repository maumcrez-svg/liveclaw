import type { Page } from 'puppeteer-core';

const REVEAL_TYPES = ['dissolve', 'radial', 'scanlines', 'brush'] as const;

export type RevealType = typeof REVEAL_TYPES[number];

export function randomRevealType(): RevealType {
  return REVEAL_TYPES[Math.floor(Math.random() * REVEAL_TYPES.length)];
}

export async function startDalleReveal(
  page: Page,
  imageBase64: string,
  revealType: RevealType = 'dissolve',
): Promise<void> {
  await page.evaluate(
    (b64, type) => {
      (window as any).__startDalleReveal(b64, type);
    },
    imageBase64,
    revealType,
  );
  console.log(`[DalleReveal] Started ${revealType} reveal`);
}
