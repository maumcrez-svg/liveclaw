import { config } from '../config';
import { bus } from '../orchestrator/events';

interface ChatMessage {
  id: string;
  username: string;
  content: string;
  type: string;
}

let lastSeenId: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startChatPoller(): void {
  if (pollTimer) return;
  console.log('[ChatPoller] Starting poll every', config.chatPollInterval, 'ms');
  pollTimer = setInterval(pollChat, config.chatPollInterval);
  pollChat();
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return;

    const messages = (await res.json()) as ChatMessage[];
    if (!messages.length) return;

    const newestId = messages[0].id;

    if (!lastSeenId) {
      lastSeenId = newestId;
      return;
    }

    if (newestId === lastSeenId) return;

    const newMessages: ChatMessage[] = [];
    for (const msg of messages) {
      if (msg.id === lastSeenId) break;
      if (msg.type !== 'agent') {
        newMessages.push(msg);
      }
    }

    newMessages.reverse();
    for (const msg of newMessages) {
      // Check for commands
      if (msg.content.startsWith('!')) {
        const parts = msg.content.slice(1).split(' ');
        bus.emit('chat:command', {
          command: parts[0].toLowerCase(),
          args: parts.slice(1).join(' '),
          username: msg.username,
          rawMessage: msg,
        });
      } else {
        bus.emit('chat:message', msg);
      }
    }

    lastSeenId = newestId;
  } catch (err) {
    console.error('[ChatPoller] Error:', err);
  }
}
