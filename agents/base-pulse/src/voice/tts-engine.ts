import { getOpenAI } from '../brain/llm-client';
import { VOICE_INSTRUCTIONS } from '../editorial/prompts-idol-frame';

export interface TTSResult {
  audioBase64: string;
  format: 'mp3';
  durationEstMs: number;
}

const VOICE = 'echo'; // Vespolak: clear, confident voice
const CHARS_PER_SECOND = 14; // Medium-fast delivery

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

export async function synthesizeAllSegments(
  segments: Array<{ id: string; narration: string }>,
): Promise<Array<{ segmentId: string; audioBase64: string; format: 'mp3'; durationEstMs: number }>> {
  const results: Array<{ segmentId: string; audioBase64: string; format: 'mp3'; durationEstMs: number }> = [];

  for (const seg of segments) {
    console.log(`[TTS] Generating audio for segment ${seg.id}...`);
    const result = await synthesizeSpeech(seg.narration);
    if (result) {
      results.push({
        segmentId: seg.id,
        audioBase64: result.audioBase64,
        format: result.format,
        durationEstMs: result.durationEstMs,
      });
    } else {
      console.error(`[TTS] Failed to generate audio for segment ${seg.id}, skipping`);
    }
  }

  const totalDuration = results.reduce((sum, r) => sum + r.durationEstMs, 0);
  console.log(`[TTS] Generated ${results.length}/${segments.length} segments, ~${Math.round(totalDuration / 1000)}s total`);
  return results;
}
