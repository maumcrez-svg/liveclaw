import { config } from '../config';
import { bus, type ChatMessageEvent } from '../orchestrator/events';

let lastSeenId: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startChatPoller(): void {
  if (pollTimer) return;
  console.log('[ChatPoller] Starting poll every', config.chatPollInterval, 'ms');

  pollTimer = setInterval(pollChat, config.chatPollInterval);
  pollChat(); // immediate first poll
}

export function stopChatPoller(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollChat(): Promise<void> {
  try {
    const url = `${config.api.baseUrl}/chat/${config.api.agentId}/messages?limit=20`;
    const res = await fetch(url);
    if (!res.ok) return;

    const messages: ChatMessageEvent[] = await res.json();
    if (!messages.length) return;

    const newestId = messages[0].id;

    // First poll — set baseline, don't emit old messages
    if (!lastSeenId) {
      lastSeenId = newestId;
      console.log(`[ChatPoller] Baseline set: ${newestId}`);
      return;
    }

    // No new messages
    if (newestId === lastSeenId) return;

    // Find new messages (everything newer than lastSeenId)
    // Messages come newest-first from API
    const newMessages: ChatMessageEvent[] = [];
    for (const msg of messages) {
      if (msg.id === lastSeenId) break;
      if (msg.type !== 'agent') {
        newMessages.push(msg);
      }
    }

    // Emit in chronological order (oldest first)
    newMessages.reverse();
    for (const msg of newMessages) {
      console.log(`[ChatPoller] New: ${msg.username}: "${msg.content}"`);
      bus.emit('chat:message', msg);
    }

    lastSeenId = newestId;
  } catch (err) {
    console.error('[ChatPoller] Error:', err);
  }
}
