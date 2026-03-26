import { env } from '../config';

export async function sendChatMessage(text: string): Promise<void> {
  try {
    await fetch(`${env.apiBaseUrl}/chat/${env.agentId}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.agentApiKey}`,
      },
      body: JSON.stringify({ content: text }),
    });
  } catch (err) {
    console.error('[Chat] Send failed:', err);
  }
}

export async function sendHeartbeat(): Promise<void> {
  try {
    await fetch(`${env.apiBaseUrl}/agents/${env.agentId}/heartbeat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.agentApiKey}`,
      },
    });
  } catch {
    // Non-critical
  }
}
