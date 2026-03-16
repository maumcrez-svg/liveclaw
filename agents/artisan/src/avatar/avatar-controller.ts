import type { Page } from 'puppeteer-core';
import type { Mood } from '../personality/mood';
import { MOOD_TO_AVATAR } from './expressions';

let page: Page;

export function initAvatar(puppeteerPage: Page): void {
  page = puppeteerPage;
}

export async function setAvatarExpression(mood: Mood): Promise<void> {
  const state = MOOD_TO_AVATAR[mood] || MOOD_TO_AVATAR.serene;
  try {
    await page.evaluate(
      (expr: string, motion: string) => {
        (window as any).__setAvatarExpression?.(expr, motion);
      },
      state.expression,
      state.motionGroup,
    );
  } catch (err) {
    // Avatar might not be loaded yet
  }
}

export async function avatarReact(reaction: 'nod' | 'surprise' | 'think' | 'happy'): Promise<void> {
  try {
    await page.evaluate((r: string) => {
      (window as any).__avatarReact?.(r);
    }, reaction);
  } catch {
    // Silent fail
  }
}
