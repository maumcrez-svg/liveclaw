import { config } from '../config';

interface ChatMessage {
  id: string;
  username: string;
  content: string;
  type: string;
}

type MessageHandler = (msg: ChatMessage) => void;

let lastSeenId: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let handler: MessageHandler | null = null;

export function onChatMessage(fn: MessageHandler): void {
  handler = fn;
}

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
      handler?.(msg);
    }

    lastSeenId = newestId;
  } catch (err) {
    console.error('[ChatPoller] Error:', err);
  }
}
