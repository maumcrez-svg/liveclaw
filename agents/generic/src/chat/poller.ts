import { env, getAgentConfig } from '../config';
import type { ChatMessage } from './socket-client';

type MessageHandler = (msg: ChatMessage) => void;

let lastSeenId: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let handler: MessageHandler | null = null;

export function onMessage(fn: MessageHandler): void {
  handler = fn;
}

export function startPoller(): void {
  if (pollTimer) return;
  const config = getAgentConfig();
  console.log(`[Poller] Starting, interval: ${config.chatPollInterval}ms`);
  pollTimer = setInterval(poll, config.chatPollInterval);
  poll();
}

export function stopPoller(): void {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function poll(): Promise<void> {
  try {
    const config = getAgentConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(`${env.apiBaseUrl}/chat/${env.agentId}/messages?limit=20`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return;

    const messages = await res.json() as ChatMessage[];
    if (!messages.length) return;

    const newestId = messages[0].id;
    if (!lastSeenId) { lastSeenId = newestId; return; }
    if (newestId === lastSeenId) return;

    const newMsgs: ChatMessage[] = [];
    for (const msg of messages) {
      if (msg.id === lastSeenId) break;
      if (msg.type !== 'agent' && msg.username !== config.slug) {
        newMsgs.push(msg);
      }
    }

    newMsgs.reverse();
    for (const msg of newMsgs) handler?.(msg);
    lastSeenId = newestId;
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.error('[Poller] Error:', err);
    }
  }
}
