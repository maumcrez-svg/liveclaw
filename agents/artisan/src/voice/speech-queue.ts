import type { Page } from 'puppeteer-core';
import { config } from '../config';
import { synthesizeSpeech } from './tts-engine';

let page: Page;
let speaking = false;
const queue: string[] = [];

export function initSpeechQueue(puppeteerPage: Page): void {
  page = puppeteerPage;
}

export async function speak(text: string): Promise<void> {
  if (config.voiceDisabled) {
    console.log('[Speech] Voice disabled, skipping TTS');
    return;
  }
  queue.push(text);
  if (!speaking) processQueue();
}

async function processQueue(): Promise<void> {
  speaking = true;
  while (queue.length > 0) {
    const text = queue.shift()!;

    const result = await synthesizeSpeech(text);
    if (!result) continue;

    try {
      // Inject audio into browser and play
      const duration = await page.evaluate(
        (audioB64: string, fmt: string) => {
          return (window as any).__playAudio(audioB64, fmt);
        },
        result.audioBase64,
        result.format,
      );

      // __playAudio already awaits audio completion; no extra sleep needed
    } catch (err) {
      console.error('[Speech] Playback error:', err);
    }
  }
  speaking = false;
}

export function isSpeaking(): boolean {
  return speaking;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
