import type { Page } from 'puppeteer-core';
import { config } from '../config';
import { getScreenPixels } from '../emulator/adapter';
import { processFrame, queueLength } from '../emulator/input';
import { parseGameState } from '../game/state-parser';
import { tickFSM, getCurrentState } from '../engine/fsm';
import { GameState } from '../game/state';
import { checkTriggers } from '../commentator/trigger-engine';
import { getExploringDebug } from '../engine/states/exploring';

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
    const pressed1 = processFrame();
    const pressed2 = processFrame();

    // Parse game state (after frames have advanced)
    const state = parseGameState();

    // Detect movement since last tick
    const moved = prevState
      ? state.position.x !== prevState.position.x ||
        state.position.y !== prevState.position.y ||
        state.position.mapId !== prevState.position.mapId
      : false;

    // Debug: structured log every 30 ticks (~1s)
    if (tickCount % 30 === 0) {
      const btns = [...new Set([...pressed1, ...pressed2])];
      const fsmState = getCurrentState();
      const explDebug = fsmState === 'EXPLORING' ? getExploringDebug() : null;

      const parts = [
        `[Loop] t=${tickCount}`,
        `fsm=${fsmState}`,
        `map=${state.position.mapName}(${state.position.mapId})`,
        `pos=(${state.position.x},${state.position.y})`,
        `moved=${moved ? 'YES' : 'no'}`,
        `battle=${state.battle.active}`,
        `cutscene=${state.menu.inCutscene}`,
        `joyIgn=0x${state.menu.joyIgnore.toString(16)}`,
        `walk=${state.menu.walkCounter}`,
        `queue=${queueLength()}`,
        `keys=[${btns.join(',')}]`,
      ];

      if (explDebug) {
        parts.push(
          `blocked=${explDebug.blocked}`,
          `detour=${explDebug.detour}`,
          `hist=${explDebug.historySize}/${explDebug.uniquePositions}u`,
        );
        // Log decision reason every 60 ticks to avoid spam
        if (tickCount % 60 === 0 && explDebug.lastReason) {
          parts.push(`| ${explDebug.lastReason}`);
        }
      }

      console.log(parts.join(' '));
    }

    // Check for game events (diff prev vs current state)
    if (prevState) {
      checkTriggers(prevState, state);
    }

    // FSM disabled — viewers control the game via chat commands (Twitch Plays style)
    // tickFSM(state);

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
