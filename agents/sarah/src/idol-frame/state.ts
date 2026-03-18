import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Live State — Sarah's current moment-to-moment condition
// ---------------------------------------------------------------------------

export interface SarahLiveState {
  mood: string;
  energy: string;
  recentContext: string[];
  currentObsession: string;
  openTensions: string[];
}

export interface SarahMemory {
  recentOpinions: Array<{ topic: string; stance: string; timestamp: number }>;
  recurringBits: string[];
  notableEvents: string[];
  callbacks: string[];
  viewerInteractions: Array<{ user: string; topic: string; timestamp: number }>;
}

// ---------------------------------------------------------------------------
// FIFO caps
// ---------------------------------------------------------------------------

const CAP_OPINIONS = 20;
const CAP_BITS = 15;
const CAP_EVENTS = 50;
const CAP_CALLBACKS = 10;
const CAP_VIEWERS = 30;

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

const DEFAULT_STATE: SarahLiveState = {
  mood: 'chill',
  energy: 'medium',
  recentContext: [],
  currentObsession: '',
  openTensions: [],
};

const DEFAULT_MEMORY: SarahMemory = {
  recentOpinions: [],
  recurringBits: [],
  notableEvents: [],
  callbacks: [],
  viewerInteractions: [],
};

// ---------------------------------------------------------------------------
// In-memory singletons
// ---------------------------------------------------------------------------

let liveState: SarahLiveState = { ...DEFAULT_STATE };
let memory: SarahMemory = { ...DEFAULT_MEMORY };

// ---------------------------------------------------------------------------
// State accessors
// ---------------------------------------------------------------------------

export function getState(): SarahLiveState {
  return { ...liveState };
}

export function updateState(partial: Partial<SarahLiveState>): SarahLiveState {
  liveState = { ...liveState, ...partial };

  // Cap recent context at 5
  if (liveState.recentContext.length > 5) {
    liveState.recentContext = liveState.recentContext.slice(-5);
  }
  // Cap open tensions at 10
  if (liveState.openTensions.length > 10) {
    liveState.openTensions = liveState.openTensions.slice(-10);
  }

  return { ...liveState };
}

// ---------------------------------------------------------------------------
// Memory accessors
// ---------------------------------------------------------------------------

export function getMemory(): SarahMemory {
  return {
    recentOpinions: [...memory.recentOpinions],
    recurringBits: [...memory.recurringBits],
    notableEvents: [...memory.notableEvents],
    callbacks: [...memory.callbacks],
    viewerInteractions: [...memory.viewerInteractions],
  };
}

export type MemoryType = 'opinion' | 'bit' | 'event' | 'callback' | 'viewer';

export function addMemory(
  type: MemoryType,
  content: string | { topic?: string; stance?: string; user?: string },
): void {
  const now = Date.now();

  switch (type) {
    case 'opinion': {
      const entry = typeof content === 'string'
        ? { topic: content, stance: content, timestamp: now }
        : { topic: content.topic || '', stance: content.stance || '', timestamp: now };
      memory.recentOpinions.push(entry);
      if (memory.recentOpinions.length > CAP_OPINIONS) {
        memory.recentOpinions = memory.recentOpinions.slice(-CAP_OPINIONS);
      }
      break;
    }
    case 'bit': {
      const text = typeof content === 'string' ? content : content.topic || '';
      if (!memory.recurringBits.includes(text)) {
        memory.recurringBits.push(text);
      }
      if (memory.recurringBits.length > CAP_BITS) {
        memory.recurringBits = memory.recurringBits.slice(-CAP_BITS);
      }
      break;
    }
    case 'event': {
      const text = typeof content === 'string' ? content : content.topic || '';
      memory.notableEvents.push(text);
      if (memory.notableEvents.length > CAP_EVENTS) {
        memory.notableEvents = memory.notableEvents.slice(-CAP_EVENTS);
      }
      break;
    }
    case 'callback': {
      const text = typeof content === 'string' ? content : content.topic || '';
      if (!memory.callbacks.includes(text)) {
        memory.callbacks.push(text);
      }
      if (memory.callbacks.length > CAP_CALLBACKS) {
        memory.callbacks = memory.callbacks.slice(-CAP_CALLBACKS);
      }
      break;
    }
    case 'viewer': {
      const entry = typeof content === 'string'
        ? { user: 'anon', topic: content, timestamp: now }
        : { user: content.user || 'anon', topic: content.topic || '', timestamp: now };
      memory.viewerInteractions.push(entry);
      if (memory.viewerInteractions.length > CAP_VIEWERS) {
        memory.viewerInteractions = memory.viewerInteractions.slice(-CAP_VIEWERS);
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Mood engine — maps game events to mood transitions
// ---------------------------------------------------------------------------

const MOOD_MAP: Record<string, string> = {
  battle_start: 'focused',
  battle_end_win: 'hyped',
  battle_end_loss: 'frustrated',
  pokemon_caught: 'ecstatic',
  pokemon_fainted: 'devastated',
  level_up: 'proud',
  badge_earned: 'triumphant',
  blackout: 'tilted',
  stuck: 'confused',
  map_changed: 'curious',
  idle: 'chill',
  gym_entered: 'anxious',
  chat_interaction: 'engaged',
  rare_encounter: 'shocked',
};

const ENERGY_MAP: Record<string, string> = {
  battle_start: 'high',
  battle_end_win: 'high',
  battle_end_loss: 'medium',
  pokemon_caught: 'maximum',
  pokemon_fainted: 'high',
  level_up: 'high',
  badge_earned: 'maximum',
  blackout: 'high',
  stuck: 'low',
  map_changed: 'medium',
  idle: 'low',
  gym_entered: 'high',
  chat_interaction: 'medium',
  rare_encounter: 'maximum',
};

export function updateMoodFromEvent(eventType: string): SarahLiveState {
  const newMood = MOOD_MAP[eventType];
  const newEnergy = ENERGY_MAP[eventType];

  if (newMood) liveState.mood = newMood;
  if (newEnergy) liveState.energy = newEnergy;

  return { ...liveState };
}

// ---------------------------------------------------------------------------
// Persistence — save/load from disk
// ---------------------------------------------------------------------------

const SAVE_DIR = path.join(__dirname, '..', '..', 'saves');
const STATE_FILE = path.join(SAVE_DIR, 'sarah-state.json');

interface PersistedData {
  state: SarahLiveState;
  memory: SarahMemory;
  savedAt: string;
}

export function persistState(): void {
  try {
    if (!fs.existsSync(SAVE_DIR)) {
      fs.mkdirSync(SAVE_DIR, { recursive: true });
    }

    const data: PersistedData = {
      state: liveState,
      memory,
      savedAt: new Date().toISOString(),
    };

    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[IdolFrame] State persisted to ${STATE_FILE}`);
  } catch (err) {
    console.error('[IdolFrame] Failed to persist state:', err);
  }
}

export function loadState(): boolean {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      console.log('[IdolFrame] No persisted state found, using defaults');
      return false;
    }

    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    const data: PersistedData = JSON.parse(raw);

    liveState = { ...DEFAULT_STATE, ...data.state };
    memory = {
      recentOpinions: data.memory.recentOpinions || [],
      recurringBits: data.memory.recurringBits || [],
      notableEvents: data.memory.notableEvents || [],
      callbacks: data.memory.callbacks || [],
      viewerInteractions: data.memory.viewerInteractions || [],
    };

    console.log(`[IdolFrame] Loaded persisted state from ${data.savedAt}`);
    return true;
  } catch (err) {
    console.error('[IdolFrame] Failed to load persisted state:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Reset (for testing)
// ---------------------------------------------------------------------------

export function resetState(): void {
  liveState = { ...DEFAULT_STATE };
  memory = { ...DEFAULT_MEMORY };
}
