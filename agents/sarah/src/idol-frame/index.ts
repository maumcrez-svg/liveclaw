import { loadEntityManifest, getManifest } from './entity-loader';
import { loadState, persistState, getState, getMemory } from './state';
import { initLossless, stopLossless } from './lossless';

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { loadEntityManifest, getManifest } from './entity-loader';
export type { EntityManifest } from './entity-loader';

export {
  getState,
  updateState,
  getMemory,
  addMemory,
  updateMoodFromEvent,
  persistState,
  loadState,
  resetState,
} from './state';
export type { SarahLiveState, SarahMemory, MemoryType } from './state';

export { buildSarahPrompt, SARAH_VOICE_INSTRUCTIONS } from './prompt-builder';

export {
  initLossless,
  stopLossless,
  record,
  recordChat,
  recordCommentary,
  recordGameEvent,
  recordDecision,
  recordSystem,
  searchRecent,
  searchByKeyword,
  getViewerHistory,
  buildLosslessContext,
  getStats as getLosslessStats,
} from './lossless';

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

export function initIdolFrame(): { ready: boolean; entityName: string; hasPersistedState: boolean } {
  console.log('[IdolFrame] Initializing...');

  // 1. Load entity manifest from sarah.yaml
  const manifest = loadEntityManifest();

  // 2. Load persisted state if it exists
  const hasPersistedState = loadState();

  // 3. Initialize lossless archive
  initLossless();

  const state = getState();
  const mem = getMemory();

  console.log(`[IdolFrame] Entity: ${manifest.entity.name} (${manifest.entity.id})`);
  console.log(`[IdolFrame] Mood: ${state.mood}, Energy: ${state.energy}`);
  console.log(`[IdolFrame] Memory: ${mem.notableEvents.length} events, ${mem.recentOpinions.length} opinions, ${mem.recurringBits.length} bits`);
  console.log('[IdolFrame] Ready.');

  return {
    ready: true,
    entityName: manifest.entity.name,
    hasPersistedState,
  };
}
