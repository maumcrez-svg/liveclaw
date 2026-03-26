import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getAgentConfig } from '../config';

let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const { llm } = getAgentConfig();
    openaiClient = new OpenAI({ apiKey: llm.apiKey });
  }
  return openaiClient;
}

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    const { llm } = getAgentConfig();
    anthropicClient = new Anthropic({ apiKey: llm.apiKey });
  }
  return anthropicClient;
}

export async function chatCompletion(system: string, userMessage: string): Promise<string> {
  const { llm } = getAgentConfig();

  switch (llm.provider) {
    case 'anthropic':
      return anthropicCompletion(system, userMessage);
    case 'google':
      return googleCompletion(system, userMessage);
    case 'openai':
    default:
      return openaiCompletion(system, userMessage);
  }
}

async function openaiCompletion(system: string, user: string): Promise<string> {
  const { llm } = getAgentConfig();
  const openai = getOpenAI();

  const res = await openai.chat.completions.create({
    model: llm.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: llm.temperature,
    max_tokens: llm.maxTokens,
  });

  const text = res.choices[0]?.message?.content?.trim() || '';
  if (!text) console.warn('[LLM] Empty response from OpenAI API');
  return text;
}

async function anthropicCompletion(system: string, user: string): Promise<string> {
  const { llm } = getAgentConfig();
  const anthropic = getAnthropic();

  const res = await anthropic.messages.create({
    model: llm.model,
    max_tokens: llm.maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const block = res.content[0];
  const text = block.type === 'text' ? block.text.trim() : '';
  if (!text) console.warn('[LLM] Empty response from Anthropic API');
  return text;
}

async function googleCompletion(system: string, user: string): Promise<string> {
  // Google Gemini via REST (no SDK dependency needed)
  const { llm } = getAgentConfig();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${llm.model}:generateContent?key=${llm.apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: user }] }],
      generationConfig: {
        temperature: llm.temperature,
        maxOutputTokens: llm.maxTokens,
      },
    }),
  });

  if (!res.ok) {
    console.error(`[Google] API error: ${res.status}`);
    return '';
  }

  const data = await res.json() as any;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  if (!text) console.warn('[LLM] Empty response from Google API');
  return text;
}
