import { GameState } from '../game/state';
import { handleExploring } from './states/exploring';
import { handleBattling } from './states/battling';
import { handleStuck } from './states/stuck';

export enum FSMState {
  EXPLORING = 'EXPLORING',
  BATTLING = 'BATTLING',
  STUCK = 'STUCK',
}

let currentState = FSMState.EXPLORING;

// ---------------------------------------------------------------------------
// Stuck detection: position hasn't changed at all
// ---------------------------------------------------------------------------
let stuckCounter = 0;
let lastX = -1;
let lastY = -1;
let lastMapId = -1;

const STUCK_THRESHOLD = 300; // ~10s at 30tps (was 450)

// ---------------------------------------------------------------------------
// Oscillation detection: position ping-pongs between few tiles
// ---------------------------------------------------------------------------
const OSC_HISTORY_SIZE = 60;  // track last 60 ticks (~2s)
const oscHistory: { x: number; y: number }[] = [];
const OSC_UNIQUE_THRESHOLD = 3; // if only 3 or fewer unique positions in 60 ticks = oscillating
const OSC_MIN_MOVES = 6;       // need at least 6 position changes to judge

let oscMoveCount = 0; // how many actual position changes in the window

export function getCurrentState(): FSMState {
  return currentState;
}

export function transitionTo(newState: FSMState): void {
  if (newState !== currentState) {
    console.log(`[FSM] ${currentState} → ${newState}`);
    currentState = newState;
    stuckCounter = 0;
    // Reset oscillation tracking on state change
    oscHistory.length = 0;
    oscMoveCount = 0;
  }
}

export function tickFSM(state: GameState): void {
  // Battle takes priority
  if (currentState !== FSMState.BATTLING && state.battle.active) {
    transitionTo(FSMState.BATTLING);
  } else if (currentState === FSMState.BATTLING && !state.battle.active) {
    transitionTo(FSMState.EXPLORING);
  }

  // Stuck + oscillation detection (only in EXPLORING)
  if (currentState === FSMState.EXPLORING) {
    const posChanged =
      state.position.x !== lastX ||
      state.position.y !== lastY ||
      state.position.mapId !== lastMapId;

    // --- Classic stuck: no movement at all ---
    // In cutscene (joyIgnore) = not stuck, game is controlling. Reset counter.
    if (state.menu.inCutscene) {
      stuckCounter = 0;
    } else if (!posChanged) {
      stuckCounter++;
      if (stuckCounter >= STUCK_THRESHOLD) {
        console.log(`[FSM] Stuck: no movement for ${stuckCounter} ticks`);
        transitionTo(FSMState.STUCK);
      }
    } else {
      stuckCounter = 0;
    }

    // --- Oscillation detection: position keeps repeating ---
    oscHistory.push({ x: state.position.x, y: state.position.y });
    if (oscHistory.length > OSC_HISTORY_SIZE) {
      oscHistory.shift();
    }
    if (posChanged) {
      oscMoveCount++;
    }

    // Only check oscillation once we have enough data
    if (oscHistory.length >= OSC_HISTORY_SIZE && oscMoveCount >= OSC_MIN_MOVES) {
      const unique = new Set(oscHistory.map(p => `${p.x},${p.y}`));
      if (unique.size <= OSC_UNIQUE_THRESHOLD) {
        const positions = Array.from(unique).join(' ');
        console.log(
          `[FSM] Oscillation detected: ${unique.size} unique positions ` +
          `in ${OSC_HISTORY_SIZE} ticks (${positions}). Transitioning to STUCK.`,
        );
        transitionTo(FSMState.STUCK);
      }
    }

    lastX = state.position.x;
    lastY = state.position.y;
    lastMapId = state.position.mapId;
  }

  // Dispatch
  switch (currentState) {
    case FSMState.EXPLORING:
      handleExploring(state);
      break;
    case FSMState.BATTLING:
      handleBattling(state);
      break;
    case FSMState.STUCK:
      handleStuck(state);
      break;
  }
}
