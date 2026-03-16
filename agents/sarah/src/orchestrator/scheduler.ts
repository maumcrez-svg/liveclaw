import { bus } from './events';
import { parseGameState } from '../game/state-parser';
import { getSaveData } from '../emulator/adapter';
import * as fs from 'fs';
import * as path from 'path';

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let saveTimer: ReturnType<typeof setInterval> | null = null;

const IDLE_MIN_MS = 60_000;
const IDLE_MAX_MS = 120_000;
const SAVE_INTERVAL_MS = 300_000; // 5 min

const SAVE_DIR = path.resolve(__dirname, '../../saves');
const SAVE_FILE = path.join(SAVE_DIR, 'pokemon-red.sav');

export function startScheduler(): void {
  scheduleIdleCommentary();
  startAutoSave();
  console.log('[Scheduler] Started (idle commentary + auto-save)');
}

export function stopScheduler(): void {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  if (saveTimer) { clearInterval(saveTimer); saveTimer = null; }
}

/**
 * Load SRAM save data from disk (if it exists).
 * Returns the save data array to pass to initEmulator, or undefined.
 */
export function loadSaveData(): any[] | undefined {
  try {
    if (fs.existsSync(SAVE_FILE)) {
      const buffer = fs.readFileSync(SAVE_FILE);
      const saveData = Array.from(buffer);
      console.log(`[Save] Loaded SRAM from ${SAVE_FILE} (${buffer.length} bytes)`);
      return saveData;
    }
  } catch (err) {
    console.error('[Save] Failed to load save data:', err);
  }
  return undefined;
}

/**
 * Persist current SRAM to disk.
 */
export function persistSaveData(): void {
  try {
    const saveData = getSaveData();
    if (!saveData || saveData.length === 0) return;

    if (!fs.existsSync(SAVE_DIR)) {
      fs.mkdirSync(SAVE_DIR, { recursive: true });
    }

    const buffer = Buffer.from(saveData);
    fs.writeFileSync(SAVE_FILE, buffer);
    console.log(`[Save] SRAM persisted to ${SAVE_FILE} (${buffer.length} bytes)`);
  } catch (err) {
    console.error('[Save] Failed to persist save data:', err);
  }
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
    persistSaveData();
  }, SAVE_INTERVAL_MS);
}
