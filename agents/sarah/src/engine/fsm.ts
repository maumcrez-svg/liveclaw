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
let stuckCounter = 0;
let lastX = -1;
let lastY = -1;
let lastMapId = -1;

const STUCK_THRESHOLD = 450; // ~15s at 30tps

export function getCurrentState(): FSMState {
  return currentState;
}

export function transitionTo(newState: FSMState): void {
  if (newState !== currentState) {
    console.log(`[FSM] ${currentState} → ${newState}`);
    currentState = newState;
    stuckCounter = 0;
  }
}

export function tickFSM(state: GameState): void {
  // Battle takes priority
  if (currentState !== FSMState.BATTLING && state.battle.active) {
    transitionTo(FSMState.BATTLING);
  } else if (currentState === FSMState.BATTLING && !state.battle.active) {
    transitionTo(FSMState.EXPLORING);
  }

  // Stuck detection (only in EXPLORING)
  if (currentState === FSMState.EXPLORING) {
    if (state.position.x === lastX && state.position.y === lastY && state.position.mapId === lastMapId) {
      stuckCounter++;
      if (stuckCounter >= STUCK_THRESHOLD) {
        transitionTo(FSMState.STUCK);
      }
    } else {
      stuckCounter = 0;
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
