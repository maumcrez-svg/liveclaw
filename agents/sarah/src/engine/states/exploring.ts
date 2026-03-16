import { GameState } from '../../game/state';
import { Button } from '../../emulator/adapter';
import { sendInput, queueLength } from '../../emulator/input';
import { getVisionDecision, canCallVision } from '../../brain/vision';
import { getNextTarget, getDirectionToward } from '../exploration/waypoints';

const DIR_MAP: Record<string, Button> = {
  up: Button.UP,
  down: Button.DOWN,
  left: Button.LEFT,
  right: Button.RIGHT,
};

const PERPENDICULAR: Record<string, Button[]> = {
  [Button.UP]: [Button.LEFT, Button.RIGHT],
  [Button.DOWN]: [Button.LEFT, Button.RIGHT],
  [Button.LEFT]: [Button.UP, Button.DOWN],
  [Button.RIGHT]: [Button.UP, Button.DOWN],
};

const DIRECTIONS = [Button.UP, Button.DOWN, Button.LEFT, Button.RIGHT];

// Known indoor maps with their door/exit coordinates
const INDOOR_EXIT_COORDS: Record<number, { x: number; y: number }> = {
  37: { x: 3, y: 7 },   // Red's House 1F
  38: { x: 7, y: 0 },   // Red's House 2F — stairs
  39: { x: 3, y: 7 },   // Blue's House
  40: { x: 4, y: 11 },  // Oak's Lab
  41: { x: 3, y: 7 },   // Poke Center (Viridian)
  42: { x: 3, y: 7 },   // Poke Mart (Viridian)
  43: { x: 3, y: 7 },   // School (Viridian)
  44: { x: 3, y: 7 },   // House (Viridian)
  48: { x: 4, y: 11 },  // Pewter Gym
  52: { x: 3, y: 7 },   // Pewter Poke Center
  57: { x: 3, y: 7 },   // Cerulean Poke Center
  58: { x: 4, y: 11 },  // Cerulean Gym
  89: { x: 3, y: 7 },   // Vermilion Poke Center
  90: { x: 4, y: 11 },  // Vermilion Gym
};

const INDOOR_MAPS = new Set(Object.keys(INDOOR_EXIT_COORDS).map(Number));

// Outdoor map exit hints
const OUTDOOR_EXIT_HINTS: Record<number, Button> = {
  0: Button.UP,     // Pallet Town -> Route 1
  12: Button.UP,    // Route 1 -> Viridian City
  1: Button.UP,     // Viridian City -> Route 2
  13: Button.UP,    // Route 2 -> Viridian Forest entrance
  51: Button.UP,    // Viridian Forest -> north exit
  2: Button.RIGHT,  // Pewter City -> Route 3
  14: Button.RIGHT, // Route 3 -> Mt. Moon
  15: Button.RIGHT, // Route 4 -> Cerulean
  3: Button.RIGHT,  // Cerulean -> east
};

// ---------------------------------------------------------------------------
// State tracking
// ---------------------------------------------------------------------------

let tickCount = 0;
let dialogTicks = 0;

// Position tracking
let lastX = -1;
let lastY = -1;
let lastMapId = -1;

// Movement confirmation: did the last input actually move us?
let pendingMoveDir: Button | null = null;
let pendingMoveTick = 0;
let consecutiveBlocked = 0;

// Position history ring buffer for anti-ping-pong
const HISTORY_SIZE = 24;
const posHistory: { x: number; y: number; mapId: number }[] = [];

// Detour state: try BOTH perpendiculars sequentially, not random
let detourPhase: 'none' | 'first' | 'second' = 'none';
let detourDirection: Button | null = null;
let detourTicksLeft = 0;
let detourPrimary: Button | null = null; // the direction we were trying when we hit the wall
let detourFirstDir: Button | null = null; // first perpendicular attempted

// Direction persistence: don't change direction mid-step
let currentDirection: Button | null = null;
let directionHoldTicks = 0;
const MIN_DIRECTION_HOLD = 6; // minimum ticks before changing direction

// Debug
let lastDebugTick = 0;
let lastDecisionReason = '';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function handleExploring(state: GameState): void {
  tickCount++;

  // =========================================================================
  // PRIORITY 1: Don't queue inputs if queue is busy
  // =========================================================================
  if (queueLength() > 0) return;

  // =========================================================================
  // PRIORITY 2: Cutscene/dialog — game is ignoring joypad input
  // Uses wJoyIgnore (reliable) instead of wAutoTextBoxDrawingControl (unreliable).
  // When in cutscene, only press A to advance. Don't navigate.
  // =========================================================================
  if (state.menu.inCutscene) {
    dialogTicks++;
    // During cutscene, just press A to advance text/dialog
    sendInput(Button.A, 4);

    if (dialogTicks > 200) {
      // Cutscene stuck too long: try B to cancel menus, DOWN to navigate
      const phase = dialogTicks % 12;
      if (phase < 4) {
        sendInput(Button.B, 4);
      } else if (phase < 8) {
        sendInput(Button.DOWN, 4);
      }
      if (dialogTicks === 201) {
        console.log(`[Explore] Cutscene stuck 200+ ticks (joyIgnore=0x${state.menu.joyIgnore.toString(16)}), trying A/B/DOWN`);
      }
      lastDecisionReason = `cutscene-stuck: joyIgnore=0x${state.menu.joyIgnore.toString(16)} (${dialogTicks} ticks)`;
    } else {
      lastDecisionReason = `cutscene: pressing A, joyIgnore=0x${state.menu.joyIgnore.toString(16)} (${dialogTicks} ticks)`;
    }
    resetMovementTracking();
    return;
  }
  dialogTicks = 0;

  // =========================================================================
  // PRIORITY 3: Player mid-step — wait for movement to complete
  // =========================================================================
  if (state.menu.isMoving) {
    lastDecisionReason = 'moving: waiting for step to complete';
    return;
  }

  // =========================================================================
  // Track position + detect movement result
  // =========================================================================
  const moved =
    state.position.x !== lastX ||
    state.position.y !== lastY ||
    state.position.mapId !== lastMapId;

  // Movement confirmation: did our last input have effect?
  if (pendingMoveDir !== null) {
    if (moved) {
      consecutiveBlocked = 0;
      pendingMoveDir = null;
    } else if (tickCount - pendingMoveTick >= 4) {
      // Input had no effect — we're blocked in that direction
      consecutiveBlocked++;
      if (consecutiveBlocked <= 2) {
        logDebug(state, `BLOCKED ${pendingMoveDir} (${consecutiveBlocked}x)`);
      }
      pendingMoveDir = null;
    }
  }

  // Update history
  if (moved || lastX === -1) {
    pushHistory(state.position.x, state.position.y, state.position.mapId);
    directionHoldTicks = 0;
  }

  lastX = state.position.x;
  lastY = state.position.y;
  lastMapId = state.position.mapId;
  directionHoldTicks++;

  // =========================================================================
  // PRIORITY 4: Navigation
  // =========================================================================

  const target = getNextTarget(
    state.position.mapId,
    state.position.x,
    state.position.y,
    state.badgeCount,
    state.party.count,
  );

  if (target) {
    if (target.mapId === state.position.mapId) {
      navigateToward(state, target.x, target.y, target.action);
    } else {
      navigateToExit(state);
    }
  } else {
    randomExplore(state);
  }

  // =========================================================================
  // Vision fallback: only when deeply stuck AND not in detour
  // =========================================================================
  if (
    consecutiveBlocked >= 8 &&
    detourPhase === 'none' &&
    canCallVision() &&
    tickCount % 100 === 0
  ) {
    logDebug(state, `Vision fallback: blocked ${consecutiveBlocked}x`);
    getVisionDecision(state)
      .then((decision) => {
        if (decision?.direction) {
          const btn = DIR_MAP[decision.direction];
          if (btn) {
            sendInput(btn, 16);
            consecutiveBlocked = 0;
          }
        } else if (decision?.action === 'interact') {
          sendInput(Button.A, 6);
        }
      })
      .catch(() => {});
  }

  // Periodic debug log
  if (tickCount - lastDebugTick >= 30) {
    logDebug(state, lastDecisionReason);
    lastDebugTick = tickCount;
  }
}

// ---------------------------------------------------------------------------
// Navigation: walk toward a tile on current map
// ---------------------------------------------------------------------------

function navigateToward(
  state: GameState,
  targetX: number,
  targetY: number,
  action?: string,
): void {
  const dx = Math.abs(state.position.x - targetX);
  const dy = Math.abs(state.position.y - targetY);

  // Arrived at waypoint
  if (dx <= 1 && dy <= 1) {
    if (action === 'interact') {
      sendInput(Button.A, 6);
      lastDecisionReason = `waypoint: interact at (${targetX},${targetY})`;
    } else if (action === 'enter') {
      const dir = getDirectionToward(state.position.x, state.position.y, targetX, targetY);
      sendInput(dir, 16);
      lastDecisionReason = `waypoint: enter toward (${targetX},${targetY})`;
    }
    return;
  }

  // Get ideal direction toward target
  const idealDir = getDirectionToward(state.position.x, state.position.y, targetX, targetY);

  // Active detour? (wall avoidance)
  if (detourPhase !== 'none' && detourDirection && detourTicksLeft > 0) {
    sendInputTracked(detourDirection, 12);
    detourTicksLeft--;
    lastDecisionReason = `detour ${detourPhase}: ${detourDirection} (${detourTicksLeft} left)`;

    // If detour completed without moving, try the other perpendicular
    if (detourTicksLeft <= 0) {
      if (detourPhase === 'first') {
        startSecondDetour();
      } else {
        endDetour();
      }
    }
    return;
  }

  // Blocked? Start detour
  if (consecutiveBlocked >= 3) {
    startDetour(idealDir);
    return;
  }

  // Anti-ping-pong: check if target direction would take us back to a recent position
  const wouldPingPong = checkPingPong(state, idealDir);
  if (wouldPingPong && directionHoldTicks < MIN_DIRECTION_HOLD) {
    // Hold current direction longer before switching to avoid oscillation
    if (currentDirection && currentDirection !== idealDir) {
      sendInputTracked(currentDirection, 12);
      lastDecisionReason = `anti-pingpong: holding ${currentDirection} (${directionHoldTicks}/${MIN_DIRECTION_HOLD})`;
      return;
    }
  }

  // Normal navigation
  currentDirection = idealDir;
  sendInputTracked(idealDir, 12);
  lastDecisionReason = `navigate: ${idealDir} toward (${targetX},${targetY}) dist=${dx + dy}`;
}

// ---------------------------------------------------------------------------
// Navigation: find map exit
// ---------------------------------------------------------------------------

function navigateToExit(state: GameState): void {
  const mapId = state.position.mapId;

  // Active detour
  if (detourPhase !== 'none' && detourDirection && detourTicksLeft > 0) {
    sendInputTracked(detourDirection, 12);
    detourTicksLeft--;
    lastDecisionReason = `exit detour ${detourPhase}: ${detourDirection}`;
    if (detourTicksLeft <= 0) {
      if (detourPhase === 'first') startSecondDetour();
      else endDetour();
    }
    return;
  }

  // Blocked? Start detour
  if (consecutiveBlocked >= 3 && currentDirection) {
    startDetour(currentDirection);
    return;
  }

  let dir: Button;

  if (INDOOR_EXIT_COORDS[mapId]) {
    const exit = INDOOR_EXIT_COORDS[mapId];
    dir = getDirectionToward(state.position.x, state.position.y, exit.x, exit.y);
    lastDecisionReason = `exit indoor: ${dir} toward (${exit.x},${exit.y})`;
  } else if (OUTDOOR_EXIT_HINTS[mapId] !== undefined) {
    dir = OUTDOOR_EXIT_HINTS[mapId];
    lastDecisionReason = `exit outdoor: ${dir} (map hint)`;
  } else {
    dir = Button.DOWN;
    lastDecisionReason = `exit unknown: DOWN (default)`;
  }

  currentDirection = dir;
  sendInputTracked(dir, 12);
}

// ---------------------------------------------------------------------------
// Random exploration fallback
// ---------------------------------------------------------------------------

function randomExplore(state: GameState): void {
  // Pick a direction that doesn't lead back to recent positions
  if (!currentDirection || directionHoldTicks >= 30) {
    const best = pickNonRecentDirection(state);
    currentDirection = best;
    directionHoldTicks = 0;
  }

  // Blocked? Pick a new direction
  if (consecutiveBlocked >= 2) {
    currentDirection = pickNonRecentDirection(state);
    consecutiveBlocked = 0;
  }

  sendInputTracked(currentDirection, 12);
  lastDecisionReason = `random: ${currentDirection}`;
}

// ---------------------------------------------------------------------------
// Detour system: try BOTH perpendiculars, not random
// ---------------------------------------------------------------------------

function startDetour(blockedDir: Button): void {
  const perps = PERPENDICULAR[blockedDir];
  if (!perps) return;

  detourPrimary = blockedDir;
  detourPhase = 'first';
  detourFirstDir = perps[0];
  detourDirection = perps[0];
  detourTicksLeft = 12;
  consecutiveBlocked = 0;
  logDebug(null, `Detour START: blocked=${blockedDir}, trying ${perps[0]} first`);
}

function startSecondDetour(): void {
  if (!detourPrimary) { endDetour(); return; }
  const perps = PERPENDICULAR[detourPrimary];
  if (!perps) { endDetour(); return; }

  // Use the OTHER perpendicular
  detourPhase = 'second';
  detourDirection = perps[0] === detourFirstDir ? perps[1] : perps[0];
  detourTicksLeft = 12;
  consecutiveBlocked = 0;
  logDebug(null, `Detour second: trying ${detourDirection}`);
}

function endDetour(): void {
  detourPhase = 'none';
  detourDirection = null;
  detourTicksLeft = 0;
  detourPrimary = null;
  detourFirstDir = null;
}

// ---------------------------------------------------------------------------
// Position history for anti-ping-pong
// ---------------------------------------------------------------------------

function pushHistory(x: number, y: number, mapId: number): void {
  posHistory.push({ x, y, mapId });
  if (posHistory.length > HISTORY_SIZE) {
    posHistory.shift();
  }
}

/**
 * Check if moving in `dir` would take us to a tile we've visited
 * recently (in the last HISTORY_SIZE positions). Returns true if
 * the resulting position appears 3+ times in history.
 */
function checkPingPong(state: GameState, dir: Button): boolean {
  const nextX = state.position.x + (dir === Button.RIGHT ? 1 : dir === Button.LEFT ? -1 : 0);
  const nextY = state.position.y + (dir === Button.DOWN ? 1 : dir === Button.UP ? -1 : 0);

  let count = 0;
  for (const p of posHistory) {
    if (p.x === nextX && p.y === nextY && p.mapId === state.position.mapId) {
      count++;
      if (count >= 3) return true;
    }
  }
  return false;
}

/**
 * Pick a direction that leads to a tile NOT recently visited, preferring
 * directions we haven't been blocked on.
 */
function pickNonRecentDirection(state: GameState): Button {
  // Score each direction: lower = better (fewer recent visits)
  let bestDir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
  let bestScore = Infinity;

  for (const dir of DIRECTIONS) {
    const nx = state.position.x + (dir === Button.RIGHT ? 1 : dir === Button.LEFT ? -1 : 0);
    const ny = state.position.y + (dir === Button.DOWN ? 1 : dir === Button.UP ? -1 : 0);

    let visits = 0;
    for (const p of posHistory) {
      if (p.x === nx && p.y === ny && p.mapId === state.position.mapId) visits++;
    }

    if (visits < bestScore) {
      bestScore = visits;
      bestDir = dir;
    }
  }

  return bestDir;
}

// ---------------------------------------------------------------------------
// Input tracking
// ---------------------------------------------------------------------------

function sendInputTracked(dir: Button, holdFrames: number): void {
  sendInput(dir, holdFrames);
  // Only track directional buttons for movement confirmation
  if (dir === Button.UP || dir === Button.DOWN || dir === Button.LEFT || dir === Button.RIGHT) {
    pendingMoveDir = dir;
    pendingMoveTick = tickCount;
  }
}

function resetMovementTracking(): void {
  pendingMoveDir = null;
  consecutiveBlocked = 0;
  detourPhase = 'none';
  detourDirection = null;
  detourTicksLeft = 0;
}

// ---------------------------------------------------------------------------
// Debug
// ---------------------------------------------------------------------------

function logDebug(state: GameState | null, reason: string): void {
  if (state) {
    const histLen = posHistory.length;
    const uniqueRecent = new Set(posHistory.map(p => `${p.x},${p.y}`)).size;
    console.log(
      `[Explore] tick=${tickCount} pos=(${state.position.x},${state.position.y}) ` +
      `map=${state.position.mapName}(${state.position.mapId}) ` +
      `blocked=${consecutiveBlocked} detour=${detourPhase} ` +
      `history=${histLen}pos/${uniqueRecent}unique | ${reason}`,
    );
  } else {
    console.log(`[Explore] tick=${tickCount} | ${reason}`);
  }
}

/**
 * Get current exploring debug state (for external debug logging).
 */
export function getExploringDebug(): {
  blocked: number;
  detour: string;
  historySize: number;
  uniquePositions: number;
  lastReason: string;
} {
  return {
    blocked: consecutiveBlocked,
    detour: detourPhase,
    historySize: posHistory.length,
    uniquePositions: new Set(posHistory.map(p => `${p.x},${p.y}`)).size,
    lastReason: lastDecisionReason,
  };
}
