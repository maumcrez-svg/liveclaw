import OpenAI from 'openai';

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export async function chatCompletion(
  system: string,
  user: string,
  model = 'gpt-4o-mini',
): Promise<string> {
  const openai = getOpenAI();
  const res = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.8,
  });
  return res.choices[0]?.message?.content?.trim() || '';
}
