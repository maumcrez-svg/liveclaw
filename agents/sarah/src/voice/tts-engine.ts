import { getOpenAI } from '../brain/llm-client';
import { VOICE_INSTRUCTIONS } from '../brain/prompts';

export interface TTSResult {
  audioBase64: string;
  format: 'mp3';
  durationEstMs: number;
}

const VOICE = 'coral';
const CHARS_PER_SECOND = 16;

export async function synthesizeSpeech(text: string): Promise<TTSResult | null> {
  try {
    const openai = getOpenAI();
    const response = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: VOICE as any,
      input: text,
      instructions: VOICE_INSTRUCTIONS,
      response_format: 'mp3',
    } as any);

    const arrayBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
    const durationEstMs = Math.max((text.length / CHARS_PER_SECOND) * 1000, 1500);

    console.log(`[TTS] Synthesized ${text.length} chars (~${Math.round(durationEstMs / 1000)}s)`);
    return { audioBase64, format: 'mp3', durationEstMs };
  } catch (err) {
    console.error('[TTS] Synthesis failed:', err);
    return null;
  }
}
