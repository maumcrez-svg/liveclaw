import { getOpenAI } from '../brain/llm-client';

export interface TTSResult {
  audioBase64: string;
  format: 'mp3' | 'wav';
  durationEstMs: number;
}

const VOICE = 'onyx'; // deep, warm — fits an artist persona
const CHARS_PER_SECOND = 14; // rough estimate for duration

export async function synthesizeSpeech(text: string): Promise<TTSResult | null> {
  try {
    const openai = getOpenAI();
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: VOICE,
      input: text,
      response_format: 'mp3',
    });

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
