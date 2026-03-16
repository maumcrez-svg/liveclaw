import fs from 'fs';
import path from 'path';

const MEMORY_PATH = path.join(__dirname, '..', '..', 'data', 'memory.json');

interface ViewerData {
  firstSeen: string;
  messageCount: number;
  lastMessage: string;
  lastSeen: string;
  favoriteCommand: string | null;
}

interface ArtHistoryEntry {
  timestamp: string;
  mode: string;
  palette: string;
  dallePrompt: string | null;
}

interface MemoryStore {
  viewers: Record<string, ViewerData>;
  artHistory: ArtHistoryEntry[];
  sessionStats: {
    startTime: string;
    totalMessages: number;
    dalleCount: number;
  };
}

let store: MemoryStore = {
  viewers: {},
  artHistory: [],
  sessionStats: {
    startTime: new Date().toISOString(),
    totalMessages: 0,
    dalleCount: 0,
  },
};

export function loadMemory(): void {
  try {
    if (fs.existsSync(MEMORY_PATH)) {
      store = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf-8'));
      console.log(`[Memory] Loaded ${Object.keys(store.viewers).length} viewers`);
    }
  } catch {
    console.log('[Memory] Starting fresh');
  }
  // Reset session stats
  store.sessionStats = {
    startTime: new Date().toISOString(),
    totalMessages: 0,
    dalleCount: 0,
  };
}

export function saveMemory(): void {
  try {
    const dir = path.dirname(MEMORY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MEMORY_PATH, JSON.stringify(store, null, 2));
  } catch (err) {
    console.error('[Memory] Save failed:', err);
  }
}

export function recordViewer(username: string, message: string, command?: string): void {
  if (!store.viewers[username]) {
    store.viewers[username] = {
      firstSeen: new Date().toISOString(),
      messageCount: 0,
      lastMessage: '',
      lastSeen: new Date().toISOString(),
      favoriteCommand: null,
    };
  }
  const v = store.viewers[username];
  v.messageCount++;
  v.lastMessage = message;
  v.lastSeen = new Date().toISOString();
  if (command) v.favoriteCommand = command;

  store.sessionStats.totalMessages++;
}

export function getViewer(username: string): ViewerData | null {
  return store.viewers[username] || null;
}

export function isFirstTimeViewer(username: string): boolean {
  return !store.viewers[username];
}

export function recordArt(mode: string, palette: string, dallePrompt: string | null): void {
  store.artHistory.push({
    timestamp: new Date().toISOString(),
    mode,
    palette,
    dallePrompt,
  });
  if (store.artHistory.length > 50) store.artHistory.shift();
  if (dallePrompt) store.sessionStats.dalleCount++;
}

export function getRecentArt(count = 5): ArtHistoryEntry[] {
  return store.artHistory.slice(-count);
}

export function getSessionStats() {
  return store.sessionStats;
}
