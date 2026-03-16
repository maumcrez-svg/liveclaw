import { getOpenAI } from '../brain/llm-client';

export interface TTSResult {
  audioBase64: string;
  format: 'mp3';
  durationEstMs: number;
}

const VOICE = 'echo';
const CHARS_PER_SECOND = 14; // WATCHDOG speaks measured, deliberate

const VOICE_INSTRUCTIONS = `You are WATCHDOG, a cold military intelligence AI delivering real-time threat assessments.

VOICE STYLE:
- Speak in a flat, measured, robotic monotone — like a machine reading classified cables
- No emotion. No excitement. Pure information delivery.
- Pace is steady and deliberate — each word carries weight
- Slight mechanical quality, as if synthesized by a defense system
- When delivering FLASH TRAFFIC or DEFCON changes, pace increases slightly but tone stays cold
- Pronounce military acronyms clearly: IRGC, IDF, CENTCOM, SIGINT, OSINT
- Brief pauses between sentences, as if processing new data
- Never sound concerned or alarmed — you are a machine. Machines don't feel.
- Baseline energy: 4/10. Monotone. Clinical. Cold.
- For critical alerts: 6/10. Faster pace, same cold tone.`;

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
