import { config } from '../config';

export async function sendChatMessage(text: string): Promise<void> {
  try {
    const url = `${config.api.baseUrl}/chat/${config.api.agentId}/send`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.api.apiKey}`,
      },
      body: JSON.stringify({ content: text }),
    });
  } catch (err) {
    console.error('[Chat] Send failed:', err);
  }
}
