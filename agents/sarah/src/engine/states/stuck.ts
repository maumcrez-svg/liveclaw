import { GameState } from '../../game/state';
import { Button } from '../../emulator/adapter';
import { sendInput, sendSequence, clearQueue, queueLength } from '../../emulator/input';
import { transitionTo, FSMState } from '../fsm';
import { getVisionDecision, canCallVision } from '../../brain/vision';

const DIRECTIONS = [Button.UP, Button.DOWN, Button.LEFT, Button.RIGHT];
const DIR_MAP: Record<string, Button> = {
  up: Button.UP, down: Button.DOWN, left: Button.LEFT, right: Button.RIGHT,
};
const BUTTON_MAP: Record<string, Button> = {
  A: Button.A, B: Button.B, START: Button.START, SELECT: Button.SELECT,
  UP: Button.UP, DOWN: Button.DOWN, LEFT: Button.LEFT, RIGHT: Button.RIGHT,
};

let stuckPhase = 0;
let phaseTickCount = 0;
let visionAttempted = false;

export function handleStuck(state: GameState): void {
  if (queueLength() > 2) return;

  phaseTickCount++;

  // Try vision first
  if (!visionAttempted && canCallVision()) {
    visionAttempted = true;
    getVisionDecision(state).then((decision) => {
      if (decision) {
        console.log(`[Stuck] Vision says: ${decision.action} - ${decision.reasoning}`);
        switch (decision.action) {
          case 'move':
            if (decision.direction) {
              const btn = DIR_MAP[decision.direction];
              if (btn) {
                for (let i = 0; i < (decision.repeat || 5); i++) sendInput(btn, 16);
              }
            }
            break;
          case 'interact':
            sendInput(Button.A, 6);
            break;
          case 'sequence':
          case 'navigate_menu':
            if (decision.buttons) {
              const buttons = decision.buttons
                .map((b) => BUTTON_MAP[b.toUpperCase()])
                .filter((b): b is Button => b !== undefined);
              sendSequence(buttons, 8, 6);
            }
            break;
        }
        setTimeout(() => {
          stuckPhase = 0;
          phaseTickCount = 0;
          visionAttempted = false;
          clearQueue();
          transitionTo(FSMState.EXPLORING);
        }, 3000);
      }
    }).catch(() => {});
  }

  switch (stuckPhase) {
    case 0:
      if (phaseTickCount <= 1) console.log('[Stuck] Phase 0: START->A');
      sendSequence([Button.START, Button.A, Button.A, Button.A], 8, 10);
      if (phaseTickCount > 30) { stuckPhase = 1; phaseTickCount = 0; }
      break;
    case 1:
      if (phaseTickCount <= 1) console.log('[Stuck] Phase 1: A-spam');
      sendInput(Button.A, 4);
      if (phaseTickCount > 30) { stuckPhase = 2; phaseTickCount = 0; }
      break;
    case 2:
      if (phaseTickCount <= 1) console.log('[Stuck] Phase 2: Walk DOWN');
      sendInput(Button.DOWN, 16);
      if (phaseTickCount > 30) { stuckPhase = 3; phaseTickCount = 0; }
      break;
    case 3:
      if (phaseTickCount <= 1) console.log('[Stuck] Phase 3: B-spam');
      sendInput(Button.B, 3);
      if (phaseTickCount > 20) { stuckPhase = 4; phaseTickCount = 0; }
      break;
    case 4:
      if (phaseTickCount <= 1) console.log('[Stuck] Phase 4: Random walk');
      sendInput(DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)], 16);
      if (phaseTickCount > 40) {
        stuckPhase = 0;
        phaseTickCount = 0;
        visionAttempted = false;
        clearQueue();
        transitionTo(FSMState.EXPLORING);
      }
      break;
  }
}
