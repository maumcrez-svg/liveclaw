/**
 * Waypoint navigation system for Pokemon Red early-game progression.
 *
 * Covers: Red's House 2F -> Pallet Town -> Oak's Lab -> Route 1 ->
 *         Viridian City -> Route 2 -> Viridian Forest -> Pewter City ->
 *         Pewter Gym (Brock) -> Route 3 -> Mt. Moon -> Route 4 -> Cerulean City
 *
 * Coordinate system: X increases going right, Y increases going down.
 * Each tile is 1 unit. Map IDs from pret/pokered WRAM (0xD35E).
 */

import { Button } from '../../emulator/adapter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Waypoint {
  id: string;
  mapId: number;
  x: number;
  y: number;
  action: 'walk' | 'interact' | 'enter' | 'wait';
  description: string;
}

/** Game progression stages based on what the player has accomplished. */
export type GameStage =
  | 'start'            // Just started, in Red's room (2F)
  | 'exit_house'       // Need to leave Red's House 1F
  | 'go_to_oak'        // Walk to Oak's Lab in Pallet Town
  | 'get_starter'      // Inside Oak's Lab, pick a starter
  | 'route1'           // Head north through Route 1
  | 'viridian'         // Arrived in Viridian City
  | 'back_to_oak'      // Deliver Oak's Parcel (back to Pallet)
  | 'viridian_forest'  // Through Route 2 and Viridian Forest
  | 'pewter'           // In Pewter City
  | 'brock'            // Beat Brock's Gym
  | 'route3'           // Heading east to Mt. Moon
  | 'mt_moon'          // Through Mt. Moon
  | 'cerulean'         // Reached Cerulean City
  | 'unknown';         // Fallback

/** A single navigation target the agent should walk/interact toward. */
export interface NavTarget {
  mapId: number;
  x: number;
  y: number;
  action: 'walk' | 'interact' | 'enter';
  description: string;
}

// ---------------------------------------------------------------------------
// Map ID constants (pret/pokered)
// ---------------------------------------------------------------------------

const MAP_PALLET_TOWN      = 0;
const MAP_VIRIDIAN_CITY     = 1;
const MAP_PEWTER_CITY       = 2;
const MAP_CERULEAN_CITY     = 3;
const MAP_ROUTE_1           = 12;
const MAP_ROUTE_2           = 13;
const MAP_ROUTE_3           = 14;
const MAP_ROUTE_4           = 15;
const MAP_REDS_HOUSE_1F     = 37;
const MAP_REDS_HOUSE_2F     = 38;
const MAP_OAKS_LAB          = 40;
const MAP_PEWTER_GYM        = 54;
const MAP_VIRIDIAN_FOREST   = 51;
// Viridian Forest gate houses
const MAP_VIRIDIAN_FOREST_SOUTH_GATE = 50;
const MAP_VIRIDIAN_FOREST_NORTH_GATE = 47;
// Mt. Moon
const MAP_MT_MOON_1F        = 59;
const MAP_MT_MOON_B1F       = 60;
const MAP_MT_MOON_B2F       = 61;

// ---------------------------------------------------------------------------
// Stage determination
// ---------------------------------------------------------------------------

/**
 * Determine the current game stage from RAM state.
 * Uses party count, badge count, and current map to infer progression.
 */
export function determineGameStage(
  mapId: number,
  badgeCount: number,
  partyCount: number,
  x: number,
  y: number,
): GameStage {
  // ---- No pokemon yet ----
  if (partyCount === 0) {
    if (mapId === MAP_REDS_HOUSE_2F) return 'start';
    if (mapId === MAP_REDS_HOUSE_1F) return 'exit_house';
    if (mapId === MAP_PALLET_TOWN)   return 'go_to_oak';
    if (mapId === MAP_OAKS_LAB)      return 'get_starter';
    // Somewhere unexpected with no pokemon -- try to leave wherever we are
    return 'exit_house';
  }

  // ---- Have pokemon, no badges ----
  if (badgeCount === 0) {
    // Still in Oak's Lab after getting starter
    if (mapId === MAP_OAKS_LAB) return 'route1';
    // Pallet Town -- head north
    if (mapId === MAP_PALLET_TOWN) return 'route1';
    // On Route 1
    if (mapId === MAP_ROUTE_1) return 'route1';
    // Viridian City
    if (mapId === MAP_VIRIDIAN_CITY) return 'viridian_forest';
    // Route 2
    if (mapId === MAP_ROUTE_2) return 'viridian_forest';
    // Viridian Forest and its gate houses
    if (mapId === MAP_VIRIDIAN_FOREST ||
        mapId === MAP_VIRIDIAN_FOREST_SOUTH_GATE ||
        mapId === MAP_VIRIDIAN_FOREST_NORTH_GATE) {
      return 'viridian_forest';
    }
    // Pewter City
    if (mapId === MAP_PEWTER_CITY) return 'brock';
    // Pewter Gym
    if (mapId === MAP_PEWTER_GYM) return 'brock';
    // Default: try heading toward Route 1
    return 'route1';
  }

  // ---- Have Boulder Badge (1 badge) ----
  if (badgeCount === 1) {
    if (mapId === MAP_PEWTER_CITY) return 'route3';
    if (mapId === MAP_PEWTER_GYM)  return 'route3';
    if (mapId === MAP_ROUTE_3)     return 'route3';
    if (mapId === MAP_MT_MOON_1F || mapId === MAP_MT_MOON_B1F || mapId === MAP_MT_MOON_B2F) {
      return 'mt_moon';
    }
    if (mapId === MAP_ROUTE_4)      return 'cerulean';
    if (mapId === MAP_CERULEAN_CITY) return 'cerulean';
    return 'route3';
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

/**
 * Ordered waypoint sequences for each game stage.
 * The agent walks through these in order. When all are reached the stage
 * should naturally transition (map change, party count change, etc.).
 */
const ROUTES: Record<GameStage, NavTarget[]> = {
  // ---- In Red's bedroom (2F) -- walk to staircase ----
  start: [
    { mapId: MAP_REDS_HOUSE_2F, x: 7, y: 1, action: 'enter', description: "Walk to stairs in Red's room" },
  ],

  // ---- Red's House 1F -- walk to front door ----
  exit_house: [
    { mapId: MAP_REDS_HOUSE_1F, x: 3, y: 7, action: 'enter', description: "Exit Red's house through front door" },
  ],

  // ---- Pallet Town -- walk to Oak's Lab entrance ----
  go_to_oak: [
    { mapId: MAP_PALLET_TOWN, x: 12, y: 11, action: 'enter', description: "Enter Oak's Lab" },
  ],

  // ---- Inside Oak's Lab -- walk to pokeball table ----
  get_starter: [
    { mapId: MAP_OAKS_LAB, x: 6, y: 4, action: 'interact', description: 'Pick a starter Pokemon from the table' },
  ],

  // ---- Route 1: Pallet Town north exit -> Viridian City ----
  route1: [
    // Walk to Pallet Town's north exit
    { mapId: MAP_PALLET_TOWN, x: 10, y: 0, action: 'walk', description: 'Head north out of Pallet Town' },
    // Walk up through Route 1 -- a few intermediate waypoints to keep on path
    { mapId: MAP_ROUTE_1, x: 10, y: 27, action: 'walk', description: 'Route 1 south section' },
    { mapId: MAP_ROUTE_1, x: 9,  y: 18, action: 'walk', description: 'Route 1 middle section' },
    { mapId: MAP_ROUTE_1, x: 5,  y: 9,  action: 'walk', description: 'Route 1 north section' },
    { mapId: MAP_ROUTE_1, x: 10, y: 0,  action: 'walk', description: 'Route 1 exit north to Viridian' },
  ],

  // ---- Viridian City: heal at Pokemon Center ----
  viridian: [
    { mapId: MAP_VIRIDIAN_CITY, x: 23, y: 19, action: 'enter', description: 'Viridian Pokemon Center' },
  ],

  // ---- Back to Oak (parcel quest) ----
  back_to_oak: [
    // South out of Viridian
    { mapId: MAP_VIRIDIAN_CITY, x: 20, y: 35, action: 'walk', description: 'Head south from Viridian' },
    // Back through Route 1
    { mapId: MAP_ROUTE_1, x: 10, y: 35, action: 'walk', description: 'Route 1 southbound' },
    { mapId: MAP_ROUTE_1, x: 10, y: 17, action: 'walk', description: 'Route 1 middle southbound' },
    // Enter Oak's Lab
    { mapId: MAP_PALLET_TOWN, x: 12, y: 11, action: 'enter', description: "Enter Oak's Lab (deliver parcel)" },
    { mapId: MAP_OAKS_LAB, x: 5, y: 2, action: 'interact', description: 'Talk to Oak (deliver parcel)' },
  ],

  // ---- Viridian -> Route 2 -> Viridian Forest -> Pewter ----
  viridian_forest: [
    // North exit of Viridian City
    { mapId: MAP_VIRIDIAN_CITY, x: 17, y: 1, action: 'walk', description: 'Head north from Viridian to Route 2' },
    // Route 2 south portion, walk north to forest gate
    { mapId: MAP_ROUTE_2, x: 3, y: 44, action: 'walk', description: 'Route 2 heading north' },
    { mapId: MAP_ROUTE_2, x: 3, y: 34, action: 'walk', description: 'Route 2 approaching forest gate' },
    // Viridian Forest south gate (walk through)
    { mapId: MAP_VIRIDIAN_FOREST_SOUTH_GATE, x: 4, y: 0, action: 'walk', description: 'Walk through south gate' },
    // Viridian Forest -- winding path north
    { mapId: MAP_VIRIDIAN_FOREST, x: 1,  y: 43, action: 'walk', description: 'Viridian Forest entrance' },
    { mapId: MAP_VIRIDIAN_FOREST, x: 17, y: 36, action: 'walk', description: 'Viridian Forest east turn' },
    { mapId: MAP_VIRIDIAN_FOREST, x: 25, y: 28, action: 'walk', description: 'Viridian Forest middle-east' },
    { mapId: MAP_VIRIDIAN_FOREST, x: 1,  y: 19, action: 'walk', description: 'Viridian Forest west loop' },
    { mapId: MAP_VIRIDIAN_FOREST, x: 17, y: 10, action: 'walk', description: 'Viridian Forest near exit' },
    { mapId: MAP_VIRIDIAN_FOREST, x: 1,  y: 1,  action: 'walk', description: 'Viridian Forest north exit' },
    // North gate
    { mapId: MAP_VIRIDIAN_FOREST_NORTH_GATE, x: 4, y: 7, action: 'walk', description: 'Walk through north gate' },
    // Route 2 north portion into Pewter
    { mapId: MAP_ROUTE_2, x: 3, y: 0, action: 'walk', description: 'Route 2 north exit to Pewter' },
  ],

  // ---- Pewter City: heal ----
  pewter: [
    { mapId: MAP_PEWTER_CITY, x: 23, y: 13, action: 'enter', description: 'Pewter Pokemon Center' },
  ],

  // ---- Beat Brock ----
  brock: [
    // Walk to Pewter Gym entrance
    { mapId: MAP_PEWTER_CITY, x: 16, y: 17, action: 'enter', description: 'Enter Pewter Gym' },
    // Walk to Brock inside the gym
    { mapId: MAP_PEWTER_GYM, x: 5, y: 3, action: 'interact', description: 'Challenge Brock' },
  ],

  // ---- Route 3 east toward Mt. Moon ----
  route3: [
    // East exit of Pewter City
    { mapId: MAP_PEWTER_CITY, x: 39, y: 10, action: 'walk', description: 'Head east from Pewter' },
    // Route 3 waypoints (long horizontal route with some vertical jogs)
    { mapId: MAP_ROUTE_3, x: 10, y: 6,  action: 'walk', description: 'Route 3 west section' },
    { mapId: MAP_ROUTE_3, x: 25, y: 4,  action: 'walk', description: 'Route 3 middle' },
    { mapId: MAP_ROUTE_3, x: 45, y: 8,  action: 'walk', description: 'Route 3 east section' },
    { mapId: MAP_ROUTE_3, x: 59, y: 4,  action: 'walk', description: 'Route 3 approaching Mt. Moon' },
  ],

  // ---- Mt. Moon (complex cave, broad waypoints) ----
  mt_moon: [
    // Mt. Moon 1F
    { mapId: MAP_MT_MOON_1F, x: 15, y: 17, action: 'walk', description: 'Mt. Moon 1F entrance area' },
    { mapId: MAP_MT_MOON_1F, x: 5,  y: 5,  action: 'walk', description: 'Mt. Moon 1F toward stairs' },
    // Mt. Moon B1F
    { mapId: MAP_MT_MOON_B1F, x: 13, y: 15, action: 'walk', description: 'Mt. Moon B1F main area' },
    { mapId: MAP_MT_MOON_B1F, x: 25, y: 5,  action: 'walk', description: 'Mt. Moon B1F toward stairs' },
    // Mt. Moon B2F
    { mapId: MAP_MT_MOON_B2F, x: 13, y: 11, action: 'walk', description: 'Mt. Moon B2F fossil room' },
    { mapId: MAP_MT_MOON_B2F, x: 5,  y: 3,  action: 'walk', description: 'Mt. Moon B2F exit stairs' },
  ],

  // ---- Cerulean City ----
  cerulean: [
    // Route 4 exit into Cerulean
    { mapId: MAP_ROUTE_4, x: 45, y: 4, action: 'walk', description: 'Route 4 east toward Cerulean' },
    // Cerulean Pokemon Center
    { mapId: MAP_CERULEAN_CITY, x: 19, y: 13, action: 'enter', description: 'Cerulean Pokemon Center' },
  ],

  // ---- Fallback ----
  unknown: [],
};

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

/**
 * Get the next navigation target for the current game state.
 *
 * Iterates through the route for the current stage and returns the first
 * waypoint that hasn't been reached yet. A waypoint is "reached" when
 * the player is on the same map and within REACH_DIST tiles.
 */
const REACH_DIST = 2;

export function getNextTarget(
  mapId: number,
  x: number,
  y: number,
  badgeCount: number,
  partyCount: number,
): NavTarget | null {
  const stage = determineGameStage(mapId, badgeCount, partyCount, x, y);
  const route = ROUTES[stage];

  if (!route || route.length === 0) return null;

  for (const target of route) {
    // If we're on a different map than this target, it's our next goal
    if (target.mapId !== mapId) {
      return target;
    }
    // Same map -- check Manhattan distance
    const dist = Math.abs(x - target.x) + Math.abs(y - target.y);
    if (dist > REACH_DIST) {
      return target;
    }
    // We're at this waypoint; skip to the next one
  }

  // All waypoints in the current route have been reached.
  // The stage will transition on the next call (map change / badge change / etc.)
  return null;
}

/**
 * Get the button to press to move one step toward the target.
 * Prioritizes the axis with the greater remaining distance.
 */
export function getDirectionToward(
  currentX: number,
  currentY: number,
  targetX: number,
  targetY: number,
): Button {
  const dx = targetX - currentX;
  const dy = targetY - currentY;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Button.RIGHT : Button.LEFT;
  }
  if (dy !== 0) {
    return dy > 0 ? Button.DOWN : Button.UP;
  }
  if (dx !== 0) {
    return dx > 0 ? Button.RIGHT : Button.LEFT;
  }

  // Already at target -- face down as a safe default
  return Button.DOWN;
}

/**
 * Get a human-readable description of the current navigation state.
 */
export function getStageDescription(
  mapId: number,
  badgeCount: number,
  partyCount: number,
  x: number,
  y: number,
): string {
  const stage = determineGameStage(mapId, badgeCount, partyCount, x, y);
  const target = getNextTarget(mapId, x, y, badgeCount, partyCount);
  if (target) {
    return `Stage: ${stage} | Next: ${target.description} (map ${target.mapId} @ ${target.x},${target.y})`;
  }
  return `Stage: ${stage} | Route complete, awaiting stage transition`;
}
