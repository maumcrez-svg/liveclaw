import OpenAI from 'openai';
import { getAgentConfig } from '../config';

export interface TTSResult {
  audioBase64: string;
  format: 'mp3';
  durationEstMs: number;
}

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    const { llm } = getAgentConfig();
    openaiClient = new OpenAI({ apiKey: llm.apiKey });
  }
  return openaiClient;
}

export async function synthesizeSpeech(text: string): Promise<TTSResult | null> {
  const config = getAgentConfig();

  if (!config.llm.apiKey || config.llm.provider !== 'openai') {
    // TTS only works with OpenAI keys for now
    return null;
  }

  try {
    const openai = getClient();
    const params: any = {
      model: config.voice.ttsModel,
      voice: config.voice.ttsVoice,
      input: text,
      response_format: 'mp3',
    };

    // Voice instructions only supported by gpt-4o-mini-tts
    if (config.voice.ttsModel === 'gpt-4o-mini-tts' && config.voice.voiceInstructions) {
      params.instructions = config.voice.voiceInstructions;
    }

    const response = await openai.audio.speech.create(params);
    const arrayBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
    const durationEstMs = Math.max((text.length / config.voice.charsPerSecond) * 1000, 1500);

    console.log(`[TTS] Synthesized ${text.length} chars (~${Math.round(durationEstMs / 1000)}s)`);
    return { audioBase64, format: 'mp3', durationEstMs };
  } catch (err) {
    console.error('[TTS] Synthesis failed:', err);
    return null;
  }
}
