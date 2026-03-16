import { isFirstTimeViewer } from './memory';
import type { ChatMessageEvent } from '../orchestrator/events';

let lastResponseTime = 0;
const MIN_RESPONSE_GAP = 10_000; // 10s

// Pending messages buffer for group responses
const pendingMessages: ChatMessageEvent[] = [];
let groupTimer: ReturnType<typeof setTimeout> | null = null;

export interface EngagementDecision {
  shouldRespond: boolean;
  messages: ChatMessageEvent[];
  isGroup: boolean;
}

export function shouldEngage(msg: ChatMessageEvent): boolean {
  const now = Date.now();
  const content = msg.content.trim();

  // Suppress: too short, recent response
  if (content.length < 1) return false;
  if (now - lastResponseTime < MIN_RESPONSE_GAP) return false;

  // Always respond: first-time viewer, commands, direct mentions
  if (isFirstTimeViewer(msg.username)) return true;
  if (content.startsWith('!')) return true;
  if (content.toLowerCase().includes('artisan')) return true;

  // 80% for questions
  if (content.includes('?')) return Math.random() < 0.8;

  // 70% for art-related messages
  const artKeywords = ['art', 'color', 'palette', 'draw', 'paint', 'beautiful', 'cool', 'nice', 'love', 'amazing'];
  if (artKeywords.some((k) => content.toLowerCase().includes(k))) return Math.random() < 0.7;

  // Base 50%
  return Math.random() < 0.5;
}

export function recordResponse(): void {
  lastResponseTime = Date.now();
}

export function addPendingMessage(msg: ChatMessageEvent): void {
  pendingMessages.push(msg);
}

export function flushPending(): EngagementDecision {
  const messages = [...pendingMessages];
  pendingMessages.length = 0;

  if (messages.length === 0) {
    return { shouldRespond: false, messages: [], isGroup: false };
  }

  if (messages.length >= 3) {
    return { shouldRespond: true, messages, isGroup: true };
  }

  // For 1-2 messages, check each individually
  const toRespond = messages.filter((m) => shouldEngage(m));
  if (toRespond.length === 0) {
    return { shouldRespond: false, messages: [], isGroup: false };
  }

  return { shouldRespond: true, messages: toRespond, isGroup: toRespond.length > 1 };
}
