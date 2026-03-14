import { GameState } from '../../game/state';
import { Button } from '../../emulator/adapter';
import { sendInput, sendSequence, queueLength } from '../../emulator/input';
import { getVisionDecision, canCallVision, VisionDecision } from '../../brain/vision';

const DIRECTIONS = [Button.UP, Button.DOWN, Button.LEFT, Button.RIGHT];
const DIR_MAP: Record<string, Button> = {
  up: Button.UP,
  down: Button.DOWN,
  left: Button.LEFT,
  right: Button.RIGHT,
};
const BUTTON_MAP: Record<string, Button> = {
  A: Button.A,
  B: Button.B,
  START: Button.START,
  SELECT: Button.SELECT,
  UP: Button.UP,
  DOWN: Button.DOWN,
  LEFT: Button.LEFT,
  RIGHT: Button.RIGHT,
};

// Track positions for wall detection
const positionHistory: { x: number; y: number; mapId: number }[] = [];
let currentPlan: VisionDecision | null = null;
let planExecutionCount = 0;
let directionBias: Button = Button.DOWN;
let biasCounter = 0;
let tickCount = 0;
let lastMapId = -1;
let visionTickCounter = 0;

export function handleExploring(state: GameState): void {
  if (queueLength() > 3) return;
  tickCount++;
  visionTickCounter++;

  // On map change, reset and request new vision decision
  if (state.position.mapId !== lastMapId) {
    lastMapId = state.position.mapId;
    directionBias = Button.DOWN;
    biasCounter = 0;
    positionHistory.length = 0;
    currentPlan = null;
    visionTickCounter = 150; // Force vision call soon
  }

  // Track position history
  positionHistory.push({
    x: state.position.x,
    y: state.position.y,
    mapId: state.position.mapId,
  });
  if (positionHistory.length > 30) positionHistory.shift();

  // Call vision every ~5 seconds (150 ticks at 30tps) or when we have no plan
  if (visionTickCounter >= 150 && canCallVision()) {
    visionTickCounter = 0;
    getVisionDecision(state)
      .then((decision) => {
        if (decision) {
          currentPlan = decision;
          planExecutionCount = 0;
        }
      })
      .catch(() => {});
  }

  // Execute current plan if we have one
  if (currentPlan) {
    const maxRepeats = currentPlan.repeat || 8;
    if (planExecutionCount < maxRepeats) {
      executePlan(currentPlan);
      planExecutionCount++;
      return;
    } else {
      currentPlan = null;
    }
  }

  // Fallback: smart random walk
  fallbackExplore(state);
}

function executePlan(plan: VisionDecision): void {
  switch (plan.action) {
    case 'move':
      if (plan.direction) {
        const btn = DIR_MAP[plan.direction];
        if (btn) sendInput(btn, 16); // Hold longer for committed movement
      }
      break;

    case 'interact':
      sendInput(Button.A, 6);
      break;

    case 'navigate_menu':
    case 'sequence':
      if (plan.buttons && plan.buttons.length > 0) {
        const buttons = plan.buttons
          .map((b) => BUTTON_MAP[b.toUpperCase()])
          .filter((b): b is Button => b !== undefined);
        if (buttons.length > 0) {
          sendSequence(buttons, 8, 6);
        }
      }
      break;

    case 'wait':
      // Do nothing for a few frames
      break;
  }
}

function fallbackExplore(state: GameState): void {
  // Detect wall bumping
  if (positionHistory.length >= 10) {
    const recent = positionHistory.slice(-10);
    const allSame = recent.every(
      (p) => p.x === recent[0].x && p.y === recent[0].y,
    );
    if (allSame) {
      const opposites: Record<string, Button> = {
        [Button.UP]: Button.DOWN,
        [Button.DOWN]: Button.UP,
        [Button.LEFT]: Button.RIGHT,
        [Button.RIGHT]: Button.LEFT,
      };
      directionBias =
        opposites[directionBias] ||
        DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      biasCounter = 0;
      positionHistory.length = 0;
    }
  }

  // Change direction bias every 60-120 ticks
  biasCounter++;
  if (biasCounter > 60 + Math.floor(Math.random() * 60)) {
    directionBias = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    biasCounter = 0;
  }

  // Interact occasionally
  if (tickCount % 25 === 0) {
    sendInput(Button.A, 4);
    return;
  }

  // Walk with bias
  if (Math.random() < 0.7) {
    sendInput(directionBias, 12);
  } else {
    sendInput(
      DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)],
      12,
    );
  }
}
