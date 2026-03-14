import { GameState } from '../../game/state';
import { Button } from '../../emulator/adapter';
import { sendInput, sendSequence, queueLength } from '../../emulator/input';
import { selectBestMove } from '../battle/move-selector';
import { shouldCatch } from '../battle/catch-evaluator';
import { getVisionDecision, canCallVision } from '../../brain/vision';

const BUTTON_MAP: Record<string, Button> = {
  A: Button.A, B: Button.B, START: Button.START, SELECT: Button.SELECT,
  UP: Button.UP, DOWN: Button.DOWN, LEFT: Button.LEFT, RIGHT: Button.RIGHT,
};
const DIR_MAP: Record<string, Button> = {
  up: Button.UP, down: Button.DOWN, left: Button.LEFT, right: Button.RIGHT,
};

let battleTickCount = 0;
let actionCooldown = 0;
let idleTickCount = 0;
let visionRequested = false;

export function handleBattling(state: GameState): void {
  if (queueLength() > 3) return;

  battleTickCount++;
  if (actionCooldown > 0) {
    actionCooldown--;
    idleTickCount = 0;
    if (state.menu.textboxOpen) {
      sendInput(Button.A, 4);
    }
    return;
  }

  idleTickCount++;

  // Vision fallback when stuck in battle
  if (idleTickCount >= 30 && !visionRequested && canCallVision()) {
    visionRequested = true;
    getVisionDecision(state).then((decision) => {
      if (decision) {
        console.log(`[Battle/Vision] ${decision.action}: ${decision.reasoning}`);
        switch (decision.action) {
          case 'move':
            if (decision.direction) {
              const btn = DIR_MAP[decision.direction];
              if (btn) sendInput(btn, 8);
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
              sendSequence(buttons, 6, 4);
            }
            break;
        }
        actionCooldown = 10;
        idleTickCount = 0;
        visionRequested = false;
      }
    }).catch(() => { visionRequested = false; });
  }

  if (state.menu.textboxOpen) {
    sendInput(Button.A, 4);
    actionCooldown = 3;
    idleTickCount = 0;
    return;
  }

  const leadMon = state.party.pokemon[0];
  if (!leadMon) return;

  if (!leadMon.isAlive) {
    idleTickCount = 0;
    sendSequence([Button.DOWN, Button.DOWN, Button.A], 4);
    actionCooldown = 15;
    for (let i = 1; i < state.party.count; i++) {
      if (state.party.pokemon[i]?.isAlive) {
        for (let j = 0; j < i; j++) sendInput(Button.DOWN, 4);
        sendInput(Button.A, 4);
        sendInput(Button.A, 4);
        break;
      }
    }
    return;
  }

  if (state.battle.isWild && shouldCatch(state)) {
    idleTickCount = 0;
    sendSequence([Button.RIGHT, Button.A], 4);
    actionCooldown = 20;
    sendInput(Button.A, 4);
    sendInput(Button.A, 4);
    return;
  }

  if (state.battle.isWild && leadMon.currentHp < leadMon.maxHp * 0.2) {
    idleTickCount = 0;
    sendSequence([Button.DOWN, Button.RIGHT, Button.A], 4);
    actionCooldown = 10;
    return;
  }

  idleTickCount = 0;
  const moveIndex = selectBestMove(leadMon, state.battle);
  sendInput(Button.A, 4);
  actionCooldown = 5;
  for (let i = 0; i < moveIndex; i++) sendInput(Button.DOWN, 4);
  sendInput(Button.A, 4);
  actionCooldown = 10;
}
