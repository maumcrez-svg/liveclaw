import { config } from '../config';

const sendQueue: string[] = [];
let sending = false;

export async function sendChatMessage(content: string): Promise<void> {
  sendQueue.push(content);
  if (!sending) processSendQueue();
}

async function processSendQueue(): Promise<void> {
  sending = true;
  while (sendQueue.length > 0) {
    const content = sendQueue.shift()!;

    // Simulate typing delay (50-100ms per char, max 3s)
    const typingDelay = Math.min(content.length * (50 + Math.random() * 50), 3000);
    await sleep(typingDelay);

    try {
      const res = await fetch(
        `${config.api.baseUrl}/chat/${config.api.agentId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.api.apiKey}`,
          },
          body: JSON.stringify({ content }),
        },
      );
      if (!res.ok) {
        console.error(`[ChatSender] Failed to send: ${res.status}`);
      }
    } catch (err) {
      console.error('[ChatSender] Error sending message:', err);
    }

    // Min gap between messages
    await sleep(1500);
  }
  sending = false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
