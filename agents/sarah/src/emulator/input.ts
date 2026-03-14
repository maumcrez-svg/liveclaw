import { Button, pressButtons, doFrame } from './adapter';

/**
 * Input system for serverboy.
 *
 * HOW SERVERBOY WORKS:
 *   1. You call pressKey("UP") — marks key in internal pressed[] array
 *   2. You call doFrame() — at frame START, applies all pressed keys.
 *                            Runs the frame. At frame END, releases ALL keys.
 *   3. Next frame starts clean (no keys held).
 *
 * So to "hold" a button for N frames, you must call pressKey() before EACH doFrame().
 *
 * This module provides a queue of actions. Each action = a set of buttons + how many
 * frames to hold them. processFrame() handles one frame: press the right keys then
 * call doFrame(). Call processFrame() in a loop from the game loop.
 */

interface QueuedAction {
  buttons: Button[];  // Empty = gap (no keys pressed)
  totalFrames: number;
  framesRemaining: number;
}

const queue: QueuedAction[] = [];
let current: QueuedAction | null = null;
let debugEnabled = true;
let lastLoggedAction = '';

// --- Public API ---

/**
 * Queue a single button press for N frames.
 */
export function sendInput(button: Button, holdFrames = 8): void {
  queue.push({ buttons: [button], totalFrames: holdFrames, framesRemaining: holdFrames });
  if (debugEnabled && lastLoggedAction !== button) {
    console.log(`[Input] Queued: ${button} x${holdFrames}f (queue: ${queue.length})`);
    lastLoggedAction = button;
  }
}

/**
 * Queue multiple simultaneous buttons for N frames.
 */
export function sendInputCombo(buttons: Button[], holdFrames = 8): void {
  queue.push({ buttons, totalFrames: holdFrames, framesRemaining: holdFrames });
}

/**
 * Queue a sequence of button presses, each held for holdFrames, with gapFrames between them.
 */
export function sendSequence(sequence: Button[], holdFrames = 8, gapFrames = 4): void {
  for (let i = 0; i < sequence.length; i++) {
    queue.push({ buttons: [sequence[i]], totalFrames: holdFrames, framesRemaining: holdFrames });
    if (gapFrames > 0 && i < sequence.length - 1) {
      queue.push({ buttons: [], totalFrames: gapFrames, framesRemaining: gapFrames });
    }
  }
  console.log(`[Input] Queued sequence: [${sequence.join(',')}] x${holdFrames}f gap${gapFrames}f`);
}

/**
 * Queue a gap (no buttons pressed) for N frames.
 */
export function sendWait(frames: number): void {
  queue.push({ buttons: [], totalFrames: frames, framesRemaining: frames });
}

/**
 * Process one frame: apply the current input action, then advance the emulator.
 * This is THE critical function — it ensures keys are pressed BEFORE doFrame().
 *
 * Returns the buttons that were pressed this frame (for debug/logging).
 */
export function processFrame(): Button[] {
  // Get current action
  if (!current || current.framesRemaining <= 0) {
    current = queue.shift() || null;
  }

  // Press buttons for this frame (before doFrame)
  const pressed: Button[] = [];
  if (current && current.buttons.length > 0) {
    pressButtons(current.buttons);
    pressed.push(...current.buttons);
  }

  // Advance emulator (this applies pressed keys, runs frame, releases keys)
  doFrame();

  // Decrement hold counter
  if (current) {
    current.framesRemaining--;
    if (current.framesRemaining <= 0) {
      current = null;
    }
  }

  return pressed;
}

/**
 * Clear all pending inputs.
 */
export function clearQueue(): void {
  queue.length = 0;
  current = null;
}

/**
 * How many actions are queued (not counting current).
 */
export function queueLength(): number {
  return queue.length + (current ? 1 : 0);
}

/**
 * Is there an active input being held?
 */
export function isActive(): boolean {
  return current !== null && current.buttons.length > 0;
}

export function setDebug(enabled: boolean): void {
  debugEnabled = enabled;
}
