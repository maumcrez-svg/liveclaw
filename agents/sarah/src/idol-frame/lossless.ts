import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Lossless Memory — append-only, verbatim, never loses anything
//
// Architecture:
//   - Every event, chat message, commentary, game state change is logged
//   - Append-only files organized by date and type
//   - Index file for fast lookup by category/date
//   - Retrieval layer searches relevant memories by context
//   - Idol Frame's filtered memory (caps 20/15/50) stays for prompt context
//   - Lossless archive is available for deep retrieval when needed
// ---------------------------------------------------------------------------

const LOSSLESS_DIR = path.join(__dirname, '..', '..', 'saves', 'lossless');

// Categories of events we store
type EventCategory =
  | 'chat'           // viewer messages
  | 'commentary'     // sarah's generated commentary
  | 'game_event'     // battles, catches, levelups, badges, map changes
  | 'decision'       // brain decisions (vision, move selection)
  | 'system'         // startup, shutdown, errors
  | 'voice'          // TTS outputs
  | 'viewer'         // viewer interactions and relationships

interface LosslessEntry {
  timestamp: string;       // ISO 8601
  epoch_ms: number;        // for fast sorting
  category: EventCategory;
  event_type: string;      // e.g. "battle_start", "chat_message", "level_up"
  content: string;         // the actual content, verbatim
  metadata?: Record<string, any>;  // extra structured data
}

// In-memory buffer — flushes to disk periodically
let buffer: LosslessEntry[] = [];
const FLUSH_INTERVAL_MS = 10_000;  // flush every 10s
const FLUSH_SIZE = 50;             // or when buffer hits 50 entries
let flushTimer: ReturnType<typeof setInterval> | null = null;
let entryCount = 0;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

export function initLossless(): void {
  if (!fs.existsSync(LOSSLESS_DIR)) {
    fs.mkdirSync(LOSSLESS_DIR, { recursive: true });
  }

  // Start periodic flush
  flushTimer = setInterval(flushToDisk, FLUSH_INTERVAL_MS);

  // Count existing entries
  try {
    const files = fs.readdirSync(LOSSLESS_DIR).filter(f => f.endsWith('.jsonl'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(LOSSLESS_DIR, file), 'utf-8');
      entryCount += content.split('\n').filter(l => l.trim()).length;
    }
  } catch { /* ignore */ }

  console.log(`[Lossless] Initialized. ${entryCount} entries in archive. Dir: ${LOSSLESS_DIR}`);
}

export function stopLossless(): void {
  flushToDisk();
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = null;
}

// ---------------------------------------------------------------------------
// Recording — append anything
// ---------------------------------------------------------------------------

export function record(
  category: EventCategory,
  eventType: string,
  content: string,
  metadata?: Record<string, any>,
): void {
  const entry: LosslessEntry = {
    timestamp: new Date().toISOString(),
    epoch_ms: Date.now(),
    category,
    event_type: eventType,
    content,
    metadata,
  };

  buffer.push(entry);
  entryCount++;

  // Auto-flush if buffer is full
  if (buffer.length >= FLUSH_SIZE) {
    flushToDisk();
  }
}

// Convenience recorders
export function recordChat(username: string, message: string): void {
  record('chat', 'chat_message', message, { username });
}

export function recordCommentary(text: string, eventType: string, mood: string): void {
  record('commentary', eventType, text, { mood });
}

export function recordGameEvent(eventType: string, details: string, gameState?: Record<string, any>): void {
  record('game_event', eventType, details, gameState);
}

export function recordDecision(decisionType: string, reasoning: string): void {
  record('decision', decisionType, reasoning);
}

export function recordSystem(eventType: string, message: string): void {
  record('system', eventType, message);
}

// ---------------------------------------------------------------------------
// Flush to disk — JSONL format, one file per day
// ---------------------------------------------------------------------------

function getFilePath(): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(LOSSLESS_DIR, `${date}.jsonl`);
}

function flushToDisk(): void {
  if (buffer.length === 0) return;

  const toWrite = [...buffer];
  buffer = [];

  try {
    const filePath = getFilePath();
    const lines = toWrite.map(e => JSON.stringify(e)).join('\n') + '\n';
    fs.appendFileSync(filePath, lines, 'utf-8');
  } catch (err) {
    console.error('[Lossless] Flush failed:', err);
    // Put entries back in buffer so they're not lost
    buffer = [...toWrite, ...buffer];
  }
}

// ---------------------------------------------------------------------------
// Retrieval — search the archive
// ---------------------------------------------------------------------------

export function getStats(): { totalEntries: number; archiveFiles: number; bufferSize: number } {
  let archiveFiles = 0;
  try {
    archiveFiles = fs.readdirSync(LOSSLESS_DIR).filter(f => f.endsWith('.jsonl')).length;
  } catch { /* ignore */ }

  return {
    totalEntries: entryCount,
    archiveFiles,
    bufferSize: buffer.length,
  };
}

/**
 * Search recent entries by category and/or event type.
 * Returns newest first, up to `limit`.
 */
export function searchRecent(
  opts: {
    category?: EventCategory;
    eventType?: string;
    limit?: number;
    sinceDaysAgo?: number;
  } = {},
): LosslessEntry[] {
  const limit = opts.limit || 20;
  const sinceMs = opts.sinceDaysAgo
    ? Date.now() - opts.sinceDaysAgo * 86400000
    : 0;

  const results: LosslessEntry[] = [];

  // Search buffer first (newest entries)
  for (let i = buffer.length - 1; i >= 0 && results.length < limit; i--) {
    const e = buffer[i];
    if (sinceMs && e.epoch_ms < sinceMs) continue;
    if (opts.category && e.category !== opts.category) continue;
    if (opts.eventType && e.event_type !== opts.eventType) continue;
    results.push(e);
  }

  if (results.length >= limit) return results;

  // Search files (newest date first)
  try {
    const files = fs.readdirSync(LOSSLESS_DIR)
      .filter(f => f.endsWith('.jsonl'))
      .sort()
      .reverse();

    for (const file of files) {
      if (results.length >= limit) break;

      const content = fs.readFileSync(path.join(LOSSLESS_DIR, file), 'utf-8');
      const lines = content.split('\n').filter(l => l.trim()).reverse();

      for (const line of lines) {
        if (results.length >= limit) break;
        try {
          const e: LosslessEntry = JSON.parse(line);
          if (sinceMs && e.epoch_ms < sinceMs) continue;
          if (opts.category && e.category !== opts.category) continue;
          if (opts.eventType && e.event_type !== opts.eventType) continue;
          results.push(e);
        } catch { /* skip malformed */ }
      }
    }
  } catch { /* ignore */ }

  return results;
}

/**
 * Search entries containing a keyword in content.
 */
export function searchByKeyword(keyword: string, limit = 10): LosslessEntry[] {
  const kw = keyword.toLowerCase();
  const results: LosslessEntry[] = [];

  // Buffer
  for (let i = buffer.length - 1; i >= 0 && results.length < limit; i--) {
    if (buffer[i].content.toLowerCase().includes(kw)) {
      results.push(buffer[i]);
    }
  }

  if (results.length >= limit) return results;

  // Files
  try {
    const files = fs.readdirSync(LOSSLESS_DIR)
      .filter(f => f.endsWith('.jsonl'))
      .sort()
      .reverse();

    for (const file of files) {
      if (results.length >= limit) break;
      const content = fs.readFileSync(path.join(LOSSLESS_DIR, file), 'utf-8');
      const lines = content.split('\n').filter(l => l.trim()).reverse();

      for (const line of lines) {
        if (results.length >= limit) break;
        try {
          const e: LosslessEntry = JSON.parse(line);
          if (e.content.toLowerCase().includes(kw)) {
            results.push(e);
          }
        } catch { /* skip */ }
      }
    }
  } catch { /* ignore */ }

  return results;
}

/**
 * Get a summary of a viewer's interaction history.
 */
export function getViewerHistory(username: string, limit = 20): LosslessEntry[] {
  return searchRecent({
    category: 'chat',
    limit,
  }).filter(e => e.metadata?.username === username);
}

/**
 * Build a context block from recent lossless entries for prompt injection.
 * This is the bridge between lossless archive and Idol Frame prompts.
 */
export function buildLosslessContext(opts: {
  maxEntries?: number;
  categories?: EventCategory[];
  sinceDaysAgo?: number;
} = {}): string {
  const maxEntries = opts.maxEntries || 15;
  const categories = opts.categories || ['chat', 'commentary', 'game_event'];
  const sinceDays = opts.sinceDaysAgo || 1;

  const entries: LosslessEntry[] = [];

  for (const cat of categories) {
    const found = searchRecent({ category: cat, limit: Math.ceil(maxEntries / categories.length), sinceDaysAgo: sinceDays });
    entries.push(...found);
  }

  // Sort by time, newest last
  entries.sort((a, b) => a.epoch_ms - b.epoch_ms);

  // Take last N
  const recent = entries.slice(-maxEntries);

  if (recent.length === 0) return '';

  const lines = recent.map(e => {
    const time = new Date(e.epoch_ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const prefix = e.category === 'chat' ? `[${e.metadata?.username || 'viewer'}]`
      : e.category === 'commentary' ? '[Sarah]'
      : `[${e.event_type}]`;
    return `${time} ${prefix} ${e.content}`;
  });

  return `RECENT STREAM HISTORY (last ${sinceDays} day${sinceDays > 1 ? 's' : ''}):\n${lines.join('\n')}`;
}
