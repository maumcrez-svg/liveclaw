import type { Page } from 'puppeteer-core';
import { config } from '../config';
import { getScreenPixels } from '../emulator/adapter';
import { processFrame } from '../emulator/input';
import { parseGameState } from '../game/state-parser';
import { tickFSM, getCurrentState } from '../engine/fsm';
import { GameState } from '../game/state';
import { checkTriggers } from '../commentator/trigger-engine';

let page: Page;
let loopTimer: ReturnType<typeof setInterval> | null = null;
let prevState: GameState | null = null;
let tickCount = 0;

export function initLoop(puppeteerPage: Page): void {
  page = puppeteerPage;
}

export function startLoop(): void {
  if (loopTimer) return;
  console.log(`[Loop] Starting game loop at ${config.tickIntervalMs}ms interval`);
  loopTimer = setInterval(tick, config.tickIntervalMs);
}

export function stopLoop(): void {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
}

function tick(): void {
  try {
    tickCount++;

    // Run 2 emulator frames per tick (~60fps at 30 ticks/sec).
    // processFrame() handles: press keys → doFrame() → release keys.
    // This is the CORRECT order per serverboy's implementation.
    const pressed1 = processFrame();
    const pressed2 = processFrame();

    // Parse game state (after frames have advanced)
    const state = parseGameState();

    // Debug: log position + pressed keys every 60 ticks (~2s)
    if (tickCount % 60 === 0) {
      const btns = [...new Set([...pressed1, ...pressed2])];
      console.log(
        `[Loop] tick=${tickCount} map=${state.position.mapName}(${state.position.mapId}) ` +
        `pos=(${state.position.x},${state.position.y}) ` +
        `battle=${state.battle.active} dialog=${state.menu.textboxOpen} ` +
        `party=${state.party.count} badges=${state.badgeCount} ` +
        `keys=[${btns.join(',')}]`
      );
    }

    // Check for game events (diff prev vs current state)
    if (prevState) {
      checkTriggers(prevState, state);
    }

    // Run FSM (decides what to do next, queues inputs for future frames)
    tickFSM(state);

    // Push frame to browser overlay
    pushFrame(state);

    prevState = state;
  } catch (err) {
    console.error('[Loop] Tick error:', err);
  }
}

async function pushFrame(state: GameState): Promise<void> {
  try {
    const pixels = getScreenPixels();
    const pixelBase64 = Buffer.from(pixels).toString('base64');

    await page.evaluate(
      (frameData: string, gameState: string, fsmState: string) => {
        (window as any).__updateGameFrame?.(frameData, gameState, fsmState);
      },
      pixelBase64,
      JSON.stringify({
        position: state.position,
        party: state.party,
        battle: state.battle,
        badges: state.badges,
        badgeCount: state.badgeCount,
        inventory: {
          pokeballs: state.inventory.pokeballs + state.inventory.greatballs + state.inventory.ultraballs,
          potions: state.inventory.potions + state.inventory.superPotions,
        },
      }),
      getCurrentState(),
    );
  } catch {
    // Ignore frame push errors
  }
}

export function getTickCount(): number {
  return tickCount;
}
