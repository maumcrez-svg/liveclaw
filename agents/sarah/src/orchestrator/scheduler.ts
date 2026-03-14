import { bus } from './events';
import { GameState } from '../game/state';
import { parseGameState } from '../game/state-parser';
import * as fs from 'fs';
import * as path from 'path';

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let saveTimer: ReturnType<typeof setInterval> | null = null;

const IDLE_MIN_MS = 60_000;
const IDLE_MAX_MS = 120_000;
const SAVE_INTERVAL_MS = 300_000; // 5 min

export function startScheduler(): void {
  scheduleIdleCommentary();
  startAutoSave();
  console.log('[Scheduler] Started (idle commentary + auto-save)');
}

export function stopScheduler(): void {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  if (saveTimer) { clearInterval(saveTimer); saveTimer = null; }
}

function scheduleIdleCommentary(): void {
  const delay = IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS);
  idleTimer = setTimeout(() => {
    try {
      const state = parseGameState();
      bus.emit('commentary:idle', state);
    } catch (err) {
      console.error('[Scheduler] Idle commentary error:', err);
    }
    scheduleIdleCommentary();
  }, delay);
}

function startAutoSave(): void {
  saveTimer = setInterval(() => {
    try {
      // We don't have save states in serverboy easily, so just log
      console.log('[Scheduler] Auto-save checkpoint');
    } catch (err) {
      console.error('[Scheduler] Auto-save error:', err);
    }
  }, SAVE_INTERVAL_MS);
}
