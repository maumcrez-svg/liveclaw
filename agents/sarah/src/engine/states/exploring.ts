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
// If coordinates are known, navigate to them. Otherwise walk DOWN.
const INDOOR_EXIT_COORDS: Record<number, { x: number; y: number }> = {
  37: { x: 3, y: 7 },   // Red's House 1F — door at bottom-left
  38: { x: 7, y: 0 },   // Red's House 2F — stairs at top-right
  39: { x: 3, y: 7 },   // Blue's House — door at bottom-left
  40: { x: 4, y: 11 },  // Oak's Lab — door at bottom-center
  41: { x: 3, y: 7 },   // Poke Center (Viridian)
  42: { x: 3, y: 7 },   // Poke Mart (Viridian)
  43: { x: 3, y: 7 },   // School (Viridian)
  44: { x: 3, y: 7 },   // House (Viridian)
  48: { x: 4, y: 11 },  // Pewter Gym — door at bottom
  52: { x: 3, y: 7 },   // Pewter Poke Center
  57: { x: 3, y: 7 },   // Cerulean Poke Center
  58: { x: 4, y: 11 },  // Cerulean Gym
  89: { x: 3, y: 7 },   // Vermilion Poke Center
  90: { x: 4, y: 11 },  // Vermilion Gym
};

const INDOOR_MAPS = new Set(Object.keys(INDOOR_EXIT_COORDS).map(Number));

// Outdoor map exit hints: mapId -> direction to walk for progression
const OUTDOOR_EXIT_HINTS: Record<number, Button> = {
  0: Button.UP,     // Pallet Town -> Route 1 (north)
  12: Button.UP,    // Route 1 -> Viridian City (north)
  1: Button.UP,     // Viridian City -> Route 2 (north)
  13: Button.UP,    // Route 2 -> Viridian Forest entrance (north)
  51: Button.UP,    // Viridian Forest -> north exit
  2: Button.RIGHT,  // Pewter City -> Route 3 (east)
  14: Button.RIGHT, // Route 3 -> Mt. Moon (east)
  15: Button.RIGHT, // Route 4 -> Cerulean (east)
  3: Button.RIGHT,  // Cerulean -> Route 5 (south) or Route 24 (north)
};

let lastX = -1;
let lastY = -1;
let lastMapId = -1;
let samePositionCount = 0;
let tickCount = 0;
let currentDirection: Button | null = null;
let detourCounter = 0;
let detourDirection: Button | null = null;

export function handleExploring(state: GameState): void {
  if (queueLength() > 2) return;
  tickCount++;

  // Track position changes
  const moved =
    state.position.x !== lastX ||
    state.position.y !== lastY ||
    state.position.mapId !== lastMapId;

  if (moved) {
    samePositionCount = 0;
    detourCounter = 0;
    detourDirection = null;
  } else {
    samePositionCount++;
  }

  lastX = state.position.x;
  lastY = state.position.y;
  lastMapId = state.position.mapId;

  // Press A frequently to advance dialogs/NPC text
  // But DON'T return — continue to navigation logic so we also walk
  if (tickCount % 8 === 0) {
    sendInput(Button.A, 3);
    // Don't return — still queue a movement after the A press
  }

  // Get navigation target from waypoint system
  const target = getNextTarget(
    state.position.mapId,
    state.position.x,
    state.position.y,
    state.badgeCount,
    state.party.count,
  );

  if (target) {
    if (target.mapId === state.position.mapId) {
      // Same map -- walk toward the target
      navigateToward(state, target.x, target.y, target.action);
    } else {
      // Different map -- find the exit
      navigateToExit(state);
    }
  } else {
    // No target or completed current stage
    randomExplore(state);
  }

  // Vision fallback only when truly stuck for a long time
  if (samePositionCount > 200 && canCallVision() && tickCount % 200 === 0) {
    console.log(`[Exploring] Stuck for ${samePositionCount} ticks, calling vision`);
    getVisionDecision(state)
      .then((decision) => {
        if (decision?.direction) {
          const btn = DIR_MAP[decision.direction];
          if (btn) {
            for (let i = 0; i < 20; i++) sendInput(btn, 16);
          }
        } else if (decision?.action === 'interact') {
          sendInput(Button.A, 6);
        }
      })
      .catch(() => {});
  }
}

/**
 * Walk toward a specific tile on the current map.
 * If wall-bumping is detected, take a perpendicular detour to get around the obstacle.
 */
function navigateToward(
  state: GameState,
  targetX: number,
  targetY: number,
  action?: string,
): void {
  // Check if we've arrived (within 1 tile)
  const dx = Math.abs(state.position.x - targetX);
  const dy = Math.abs(state.position.y - targetY);

  if (dx <= 1 && dy <= 1) {
    // At the waypoint
    if (action === 'interact') {
      sendInput(Button.A, 6);
    } else if (action === 'enter') {
      // Walk into the tile (continue current direction)
      const dir = getDirectionToward(
        state.position.x,
        state.position.y,
        targetX,
        targetY,
      );
      sendInput(dir, 16);
    }
    return;
  }

  // Wall bump detection: if stuck for 15+ ticks, try perpendicular detour
  if (samePositionCount > 15 && detourCounter <= 0) {
    const primaryBtn = getDirectionToward(
      state.position.x,
      state.position.y,
      targetX,
      targetY,
    );
    const perps = PERPENDICULAR[primaryBtn];
    if (perps) {
      detourDirection = perps[Math.floor(Math.random() * perps.length)];
      detourCounter = 20; // try perpendicular for 20 ticks
      console.log(
        `[Exploring] Wall bump detected, detouring ${detourDirection}`,
      );
    }
  }

  // Execute detour if active
  if (detourCounter > 0 && detourDirection) {
    sendInput(detourDirection, 16);
    detourCounter--;
    return;
  }

  // Normal navigation: walk toward target
  const dir = getDirectionToward(
    state.position.x,
    state.position.y,
    targetX,
    targetY,
  );
  currentDirection = dir;
  sendInput(dir, 16);
}

/**
 * Navigate toward the map exit when our target is on a different map.
 * Indoor maps: walk down toward the door.
 * Outdoor maps: walk toward the known exit direction, or down by default.
 */
function navigateToExit(state: GameState): void {
  const mapId = state.position.mapId;

  // Wall bump detour logic (same as navigateToward)
  if (samePositionCount > 15 && detourCounter <= 0 && currentDirection) {
    const perps = PERPENDICULAR[currentDirection];
    detourDirection = perps[Math.floor(Math.random() * perps.length)];
    detourCounter = 20;
    console.log(
      `[Exploring] Exit navigation wall bump, detouring ${detourDirection}`,
    );
  }

  if (detourCounter > 0 && detourDirection) {
    sendInput(detourDirection, 16);
    detourCounter--;
    return;
  }

  if (INDOOR_EXIT_COORDS[mapId]) {
    // Indoor: navigate toward the known door coordinates
    const exit = INDOOR_EXIT_COORDS[mapId];
    const dir = getDirectionToward(state.position.x, state.position.y, exit.x, exit.y);
    currentDirection = dir;
    sendInput(dir, 16);
  } else if (OUTDOOR_EXIT_HINTS[mapId] !== undefined) {
    // Known outdoor: walk toward progression direction
    currentDirection = OUTDOOR_EXIT_HINTS[mapId];
    sendInput(currentDirection, 16);
  } else {
    // Unknown map: walk down as a default
    currentDirection = Button.DOWN;
    sendInput(Button.DOWN, 16);
  }
}

/**
 * Fallback when no waypoint target is available.
 * Walk randomly with occasional A presses.
 */
function randomExplore(state: GameState): void {
  // Interact occasionally
  if (tickCount % 12 === 0) {
    sendInput(Button.A, 4);
    return;
  }

  // Random directional walking with some persistence
  if (!currentDirection || tickCount % 40 === 0) {
    currentDirection = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
  }

  // Wall bump: change direction
  if (samePositionCount > 15) {
    currentDirection = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    samePositionCount = 0;
  }

  sendInput(currentDirection, 12);
}
