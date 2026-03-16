import { getOpenAI } from './llm-client';

export async function generateImage(prompt: string): Promise<string | null> {
  const openai = getOpenAI();
  try {
    console.log(`[DALL-E] Generating: "${prompt}"`);
    const res = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1792x1024',
      response_format: 'b64_json',
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) {
      console.error('[DALL-E] No image data returned');
      return null;
    }
    console.log(`[DALL-E] Generated successfully (${Math.round(b64.length / 1024)}KB)`);
    return b64;
  } catch (err) {
    console.error('[DALL-E] Error:', err);
    return null;
  }
}
