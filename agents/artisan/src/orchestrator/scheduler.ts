import { bus } from './events';
import { chatCompletion } from '../brain/llm-client';
import { generateImage } from '../brain/image-client';
import { buildAutoDallePrompt, buildDallePrompt, buildSystemPrompt } from '../brain/prompt-templates';
import { getCurrentMood, driftMood, setMood, MOOD_EMOJI } from '../personality/mood';
import { recordArt, getSessionStats } from '../personality/memory';
import { sendChatMessage } from '../chat/chat-sender';
import { speak } from '../voice/speech-queue';
import { config } from '../config';

async function sayAndSend(text: string): Promise<void> {
  await sendChatMessage(text);
  speak(text).catch(() => {});
}

interface ScheduledEvent {
  name: string;
  intervalMin: number;
  intervalMax: number;
  lastRun: number;
  nextRun: number;
  handler: () => Promise<void>;
}

function randomInterval(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

let currentMode = 'flow-field';
let currentPalette = 'default';

export function setCurrentMode(mode: string): void {
  currentMode = mode;
}

export function setCurrentPalette(palette: string): void {
  currentPalette = palette;
}

const events: ScheduledEvent[] = [
  {
    name: 'auto-dalle',
    intervalMin: 10 * 60_000,
    intervalMax: 20 * 60_000,
    lastRun: 0,
    nextRun: randomInterval(10 * 60_000, 20 * 60_000) + Date.now(),
    handler: async () => {
      const mood = getCurrentMood();
      const prompt = await chatCompletion(
        'You are a creative AI artist.',
        buildAutoDallePrompt(mood, currentMode),
      );
      if (!prompt) return;

      bus.emit('dalle:start', prompt);
      await sayAndSend(`Time to paint something new... "${prompt}"`);

      const fullPrompt = buildDallePrompt(prompt, mood);
      const imageBase64 = await generateImage(fullPrompt);
      if (imageBase64) {
        bus.emit('dalle:complete', imageBase64, prompt);
        recordArt(currentMode, currentPalette, prompt);
        await sayAndSend('There it is... what do you think?');
      }
    },
  },
  {
    name: 'mood-drift',
    intervalMin: 5 * 60_000,
    intervalMax: 15 * 60_000,
    lastRun: 0,
    nextRun: randomInterval(5 * 60_000, 15 * 60_000) + Date.now(),
    handler: async () => {
      const newMood = driftMood();
      if (newMood) {
        const prev = setMood(newMood);
        bus.emit('mood:change', newMood, prev);
      }
    },
  },
  {
    name: 'art-break',
    intervalMin: 30 * 60_000,
    intervalMax: 30 * 60_000,
    lastRun: 0,
    nextRun: 30 * 60_000 + Date.now(),
    handler: async () => {
      const mood = getCurrentMood();
      const stats = getSessionStats();
      const systemPrompt = buildSystemPrompt(mood, currentMode, currentPalette);
      const comment = await chatCompletion(
        systemPrompt,
        `You've been streaming for a while. Total messages from viewers: ${stats.totalMessages}. DALL-E paintings: ${stats.dalleCount}. Share a brief reflection about your art session (1-2 sentences).`,
      );
      if (comment) await sayAndSend(comment);
    },
  },
  {
    name: 'style-rotation',
    intervalMin: 60 * 60_000,
    intervalMax: 60 * 60_000,
    lastRun: 0,
    nextRun: 60 * 60_000 + Date.now(),
    handler: async () => {
      const modes = ['flow-field', 'particles', 'fractals', 'watercolor', 'geometric'];
      const next = modes.filter((m) => m !== currentMode);
      const newMode = next[Math.floor(Math.random() * next.length)];
      bus.emit('visual:mode', newMode);
      await sayAndSend(`Switching things up... let's try some ${newMode.replace('-', ' ')} art`);
    },
  },
];

export function tickScheduler(): void {
  const now = Date.now();
  for (const evt of events) {
    if (now >= evt.nextRun) {
      evt.lastRun = now;
      evt.nextRun = now + randomInterval(evt.intervalMin, evt.intervalMax);
      evt.handler().catch((err) => console.error(`[Scheduler] ${evt.name} error:`, err));
    }
  }
}

export async function sendStartupMessage(): Promise<void> {
  const mood = getCurrentMood();
  const emoji = MOOD_EMOJI[mood];
  await sayAndSend(
    `Hey! ArtisanAI here, back at the canvas. Feeling ${mood} today. Let's create something beautiful together.`,
  );
}
