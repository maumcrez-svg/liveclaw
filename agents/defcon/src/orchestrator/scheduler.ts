import { config } from '../config';
import { bus } from './events';
import { chatCompletion } from '../brain/llm-client';
import { SYSTEM_PERSONA, SITREP_PROMPT, AMBIENT_PROMPT, fillTemplate } from '../brain/prompts';
import { speak, isSpeaking } from '../voice/speech-queue';
import { sendChatMessage } from '../chat/chat-sender';
import { updateCommsPanel } from '../intel/bridge';
import * as store from '../intel/intel-store';

let sitrepTimer: ReturnType<typeof setTimeout> | null = null;
let ambientTimer: ReturnType<typeof setTimeout> | null = null;
const startTime = Date.now();

function randomInterval(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min));
}

export function startScheduler(): void {
  // Listen for manual sitrep requests
  bus.on('sitrep:request', deliverSitrep);

  // Schedule first SITREP
  scheduleSitrep();
  scheduleAmbient();
  console.log('[Scheduler] Ambient commentary scheduled');
  console.log('[Scheduler] Started — SITREP scheduled');
}

export function stopScheduler(): void {
  if (sitrepTimer) {
    clearTimeout(sitrepTimer);
    sitrepTimer = null;
  }
  if (ambientTimer) {
    clearTimeout(ambientTimer);
    ambientTimer = null;
  }
  bus.removeListener('sitrep:request', deliverSitrep);
}

function scheduleSitrep(): void {
  const interval = randomInterval(config.sitrepIntervalMin, config.sitrepIntervalMax);
  console.log(`[Scheduler] Next SITREP in ${Math.round(interval / 60_000)}min`);
  sitrepTimer = setTimeout(async () => {
    await deliverSitrep();
    scheduleSitrep(); // Reschedule
  }, interval);
}

async function deliverSitrep(): Promise<void> {
  console.log('[Scheduler] Delivering SITREP...');
  await updateCommsPanel('SITREP', 'Compiling situation report...');

  try {
    const narration = await chatCompletion(
      SYSTEM_PERSONA,
      fillTemplate(SITREP_PROMPT, {
        defconLevel: store.getDefconLevel(),
        flightCount: store.getFlightCount(),
        vesselCount: store.getVesselCount(),
        recentIntel: store.getRecentSummary(8),
      }),
    );

    if (narration) {
      await sendChatMessage('📡 SITREP — Periodic Situation Report');
      await speak(narration);
      await sendChatMessage(narration);
    }
  } catch (err) {
    console.error('[Scheduler] SITREP delivery failed:', err);
  }

  await updateCommsPanel('IDLE', '');
}

function scheduleAmbient(): void {
  const interval = randomInterval(config.ambientIntervalMin, config.ambientIntervalMax);
  console.log(`[Scheduler] Next ambient in ${Math.round(interval / 60_000)}min`);
  ambientTimer = setTimeout(async () => {
    await deliverAmbient();
    scheduleAmbient();
  }, interval);
}

async function deliverAmbient(): Promise<void> {
  if (isSpeaking()) return; // Don't interrupt

  console.log('[Scheduler] Delivering ambient commentary...');
  await updateCommsPanel('AMBIENT', '');

  try {
    const uptime = Math.round((Date.now() - startTime) / 60_000);
    const commentary = await chatCompletion(
      SYSTEM_PERSONA,
      fillTemplate(AMBIENT_PROMPT, {
        defconLevel: store.getDefconLevel(),
        flightCount: store.getFlightCount(),
        uptime: `${uptime} minutes`,
        recentIntel: store.getRecentSummary(5),
      }),
    );

    if (commentary) {
      await speak(commentary);
      await sendChatMessage(commentary);
    }
  } catch (err) {
    console.error('[Scheduler] Ambient delivery failed:', err);
  }

  await updateCommsPanel('IDLE', '');
}
