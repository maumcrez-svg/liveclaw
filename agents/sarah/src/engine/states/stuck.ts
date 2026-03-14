import { GameState } from '../../game/state';
import { Button } from '../../emulator/adapter';
import { sendInput, clearQueue, queueLength } from '../../emulator/input';
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

  // Mechanical recovery phases
  switch (stuckPhase) {
    case 0:
      // Phase 0: A-spam (most common cause: cutscene/dialog waiting for input)
      if (phaseTickCount <= 1) console.log('[Stuck] Phase 0: A-spam (dialog/cutscene)');
      sendInput(Button.A, 4);
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
