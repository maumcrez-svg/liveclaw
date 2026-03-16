import OpenAI from 'openai';
import { config } from '../config';

let client: OpenAI;

export function getOpenAI(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return client;
}

export async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const openai = getOpenAI();
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 150,
      temperature: 0.9,
    });
    return res.choices[0]?.message?.content?.trim() || '';
  } catch (err) {
    console.error('[LLM] Error:', err);
    return '';
  }
}
