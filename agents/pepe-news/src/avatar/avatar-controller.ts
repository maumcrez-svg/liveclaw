import type { Page } from 'puppeteer-core';
import type { AvatarExpression } from '../models/types';
import { EXPRESSION_MAP } from './expressions';

let page: Page;

export function initAvatar(puppeteerPage: Page): void {
  page = puppeteerPage;
}

export async function setAvatarExpression(expression: AvatarExpression): Promise<void> {
  const state = EXPRESSION_MAP[expression] || EXPRESSION_MAP.neutral;
  try {
    await page.evaluate(
      (expr: string, brow: string) => {
        (window as any).__setExpression?.(expr, brow);
      },
      state.expression,
      state.browStyle,
    );
  } catch {
    // Avatar might not be loaded yet
  }
}
