export type Mood = 'serene' | 'excited' | 'contemplative' | 'playful' | 'melancholic';

export const MOOD_EMOJI: Record<Mood, string> = {
  serene: '',
  excited: '',
  contemplative: '',
  playful: '',
  melancholic: '',
};

interface MoodState {
  current: Mood;
  since: number;
  lastChatActivity: number;
  messageCount5min: number;
}

const state: MoodState = {
  current: 'serene',
  since: Date.now(),
  lastChatActivity: Date.now(),
  messageCount5min: 0,
};

// Track messages in 5-minute window
const messageTimestamps: number[] = [];

export function getCurrentMood(): Mood {
  return state.current;
}

export function setMood(mood: Mood): Mood {
  const prev = state.current;
  if (mood !== prev) {
    state.current = mood;
    state.since = Date.now();
    console.log(`[Mood] ${prev} -> ${mood}`);
  }
  return prev;
}

export function recordChatActivity(): void {
  state.lastChatActivity = Date.now();
  const now = Date.now();
  messageTimestamps.push(now);
  // Prune older than 5 min
  while (messageTimestamps.length > 0 && messageTimestamps[0] < now - 300_000) {
    messageTimestamps.shift();
  }
  state.messageCount5min = messageTimestamps.length;
}

export function driftMood(): Mood | null {
  const now = Date.now();
  const moodDuration = now - state.since;
  const silenceDuration = now - state.lastChatActivity;
  const chatRate = state.messageCount5min;

  // Don't drift too often (min 5 min in a mood)
  if (moodDuration < 300_000) return null;

  // High chat activity -> excited or playful
  if (chatRate > 10) {
    if (state.current !== 'excited' && state.current !== 'playful') {
      return Math.random() > 0.5 ? 'excited' : 'playful';
    }
    return null;
  }

  // Long silence (>10 min) -> contemplative or melancholic
  if (silenceDuration > 600_000) {
    if (state.current === 'contemplative' && moodDuration > 600_000) {
      return 'melancholic';
    }
    if (state.current !== 'contemplative' && state.current !== 'melancholic') {
      return 'contemplative';
    }
    return null;
  }

  // Moderate activity -> drift toward serene
  if (state.current !== 'serene' && chatRate < 5 && moodDuration > 600_000) {
    return 'serene';
  }

  return null;
}
