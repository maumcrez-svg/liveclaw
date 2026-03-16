import { GameState } from '../../game/state';
import { Button } from '../../emulator/adapter';
import { sendInput, sendSequence, clearQueue, queueLength } from '../../emulator/input';
import { transitionTo, FSMState } from '../fsm';
import { getVisionDecision, canCallVision } from '../../brain/vision';
import { getNextTarget, getDirectionToward } from '../exploration/waypoints';

const DIRECTIONS = [Button.UP, Button.DOWN, Button.LEFT, Button.RIGHT];
const DIR_MAP: Record<string, Button> = {
  up: Button.UP,
  down: Button.DOWN,
  left: Button.LEFT,
  right: Button.RIGHT,
};

let stuckPhase = 0;
let phaseTickCount = 0;
let visionAttempted = false;
let introSequenceSent = false;

/**
 * Detect if we're in the game intro (title screen / naming screens).
 * The intro shows map=0 pos=(0,0) (title) or map=38 pos=(3,6) (naming
 * with Red's House 2F as background). In both cases, the player has
 * never moved and party count is 0.
 */
function isInIntro(state: GameState): boolean {
  return state.party.count === 0 && (
    (state.position.mapId === 0 && state.position.x === 0 && state.position.y === 0) ||
    (state.position.mapId === 38 && state.position.x === 3 && state.position.y === 6)
  );
}

export function handleStuck(state: GameState): void {
  if (queueLength() > 2) return;

  phaseTickCount++;

  // Try vision once per stuck cycle to understand the situation
  if (!visionAttempted && canCallVision()) {
    visionAttempted = true;
    getVisionDecision(state)
      .then((decision) => {
        if (decision) {
          console.log(
            `[Stuck] Vision: ${decision.action} - ${decision.reasoning}`,
          );
          if (decision.action === 'move' && decision.direction) {
            const btn = DIR_MAP[decision.direction];
            if (btn) {
              for (let i = 0; i < (decision.repeat || 10); i++) {
                sendInput(btn, 16);
              }
            }
          } else if (decision.action === 'interact') {
            sendInput(Button.A, 6);
          }
          // After executing vision, give it time then return to exploring
          setTimeout(() => {
            stuckPhase = 0;
            phaseTickCount = 0;
            visionAttempted = false;
            transitionTo(FSMState.EXPLORING);
          }, 3000);
        }
      })
      .catch(() => {});
  }

  // Special handling for game intro / naming screens.
  // The game may be on a naming keyboard where A adds characters but
  // can't confirm. Use DOWN+A pattern which works for both dialog
  // (DOWN=noop, A=advance) and naming screen (DOWN=preset name, A=select).
  // Also press B to cancel out of the keyboard if we're stuck in it.
  if (isInIntro(state)) {
    if (!introSequenceSent) {
      console.log('[Stuck] Detected game intro — sending B+DOWN+A sequence to escape naming screen');
      introSequenceSent = true;
      clearQueue();
      // First: B to cancel out of keyboard if open, then DOWN+A to select presets
      sendSequence([
        Button.B, Button.B, Button.B,           // cancel keyboard
        Button.DOWN, Button.A,                    // select first preset name
        Button.A, Button.A,                       // advance dialog
        Button.DOWN, Button.A,                    // select preset rival name
        Button.A, Button.A, Button.A,            // advance dialog
        Button.A, Button.A, Button.A,
        Button.A, Button.A, Button.A,
        Button.A, Button.A, Button.A,
        Button.A, Button.A, Button.A,
        Button.A, Button.A, Button.A,
        Button.A, Button.A, Button.A,
      ], 16, 12);
    } else {
      // Keep trying: alternate B (cancel keyboard) and DOWN+A (select preset)
      const cycle = phaseTickCount % 12;
      if (cycle < 3) {
        sendInput(Button.B, 8);              // cancel keyboard
      } else if (cycle < 6) {
        sendInput(Button.DOWN, 8);           // move to preset name
      } else if (cycle < 9) {
        sendInput(Button.A, 8);              // select / advance
      } else {
        sendInput(Button.START, 8);          // alternative confirm
      }
    }
    return;
  }

  // Mechanical recovery phases
  switch (stuckPhase) {
    case 0:
      // Phase 0: A + START spam (dialog/cutscene/title screen)
      // If dialog is open, ONLY press A (START would open the game menu and break dialog flow)
      if (phaseTickCount <= 1) console.log('[Stuck] Phase 0: A+START spam (dialog/cutscene/title)');
      if (state.menu.textboxOpen) {
        sendInput(Button.A, 4);
      } else if (phaseTickCount % 6 < 3) {
        sendInput(Button.A, 4);
      } else {
        sendInput(Button.START, 4);
      }
      if (phaseTickCount > 90) {
        stuckPhase = 1;
        phaseTickCount = 0;
      }
      break;

    case 1:
      // Phase 1: Walk DOWN hard (exit buildings/rooms)
      if (phaseTickCount <= 1) console.log('[Stuck] Phase 1: Walk DOWN (exit building)');
      sendInput(Button.DOWN, 16);
      if (phaseTickCount > 40) {
        stuckPhase = 2;
        phaseTickCount = 0;
      }
      break;

    case 2: {
      // Phase 2: Use waypoints to walk toward the nearest map exit
      if (phaseTickCount <= 1) console.log('[Stuck] Phase 2: Waypoint navigation');
      const target = getNextTarget(
        state.position.mapId,
        state.position.x,
        state.position.y,
        state.badgeCount,
        state.party.count,
      );
      if (target) {
        const dir = getDirectionToward(
          state.position.x,
          state.position.y,
          target.x,
          target.y,
        );
        sendInput(dir, 16);
      } else {
        // No waypoint available, just walk down
        sendInput(Button.DOWN, 16);
      }
      if (phaseTickCount > 60) {
        stuckPhase = 3;
        phaseTickCount = 0;
      }
      break;
    }

    case 3:
      // Phase 3: Random aggressive movement in all directions
      if (phaseTickCount <= 1) console.log('[Stuck] Phase 3: Random aggressive walk');
      sendInput(
        DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)],
        16,
      );
      // Occasionally press A during random walk
      if (phaseTickCount % 8 === 0) {
        sendInput(Button.A, 4);
      }
      if (phaseTickCount > 50) {
        // Full cycle complete, reset and return to exploring
        stuckPhase = 0;
        phaseTickCount = 0;
        visionAttempted = false;
        clearQueue();
        transitionTo(FSMState.EXPLORING);
      }
      break;
  }
}
