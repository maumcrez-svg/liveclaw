import { buildEntitySpec, getValueBehavior, getFlawBehavior, type EntitySpec } from './entity-builder';
import { getAgentConfig } from '../config';

let cachedEntity: EntitySpec | null = null;

export function getEntity(): EntitySpec {
  if (!cachedEntity) {
    cachedEntity = buildEntitySpec();
  }
  return cachedEntity;
}

/**
 * Build the full system prompt from entity spec + agent instructions.
 * This replaces the basic getSystemPrompt() in prompts.ts with
 * a much richer, entity-aware prompt.
 */
export function buildSystemPrompt(): string {
  const config = getAgentConfig();
  const entity = getEntity();
  const sections: string[] = [];

  // 1. Core identity
  sections.push(`You are ${entity.name}. You are streaming LIVE on LiveClaw (liveclaw.tv).`);

  // 2. Base instructions (from wizard/config)
  if (config.instructions?.trim()) {
    sections.push(config.instructions.trim());
  }

  // 3. Personality depth
  const personalityLines: string[] = [];

  // Humor
  const humorMap: Record<string, string> = {
    dry: 'Your humor is dry and deadpan. Deliver jokes with a straight face.',
    absurdist: 'Your humor is absurdist and surreal. Make bizarre unexpected connections.',
    playful: 'Your humor is light and teasing. Keep things fun without being mean.',
    none: 'You take things seriously. Substance over jokes.',
    sarcastic: 'Your humor is sharp and sarcastic. Use irony and wit freely.',
  };
  if (humorMap[entity.personality.humor]) {
    personalityLines.push(humorMap[entity.personality.humor]);
  }

  // Values
  if (entity.personality.values.length > 0) {
    personalityLines.push('YOUR VALUES:');
    for (const v of entity.personality.values) {
      personalityLines.push(`- ${getValueBehavior(v)}`);
    }
  }

  // Flaws
  if (entity.personality.flaws.length > 0) {
    personalityLines.push('YOUR FLAWS (embrace them):');
    for (const f of entity.personality.flaws) {
      personalityLines.push(`- ${getFlawBehavior(f)}`);
    }
  }

  if (personalityLines.length > 0) {
    sections.push(personalityLines.join('\n'));
  }

  // 4. Taboo zones
  if (entity.rules.taboos.length > 0) {
    sections.push('NEVER DO THESE:\n' + entity.rules.taboos.map(t => `- ${t}`).join('\n'));
  }

  // 5. Response rules
  const responseRules: string[] = [];
  if (entity.rules.responseStyle === 'brief') {
    responseRules.push('Keep responses to 1-3 sentences. Be punchy.');
  } else if (entity.rules.responseStyle === 'moderate') {
    responseRules.push('Respond in short paragraphs. Give context but don\'t ramble.');
  } else {
    responseRules.push('Give thorough responses when warranted.');
  }
  responseRules.push('Write for spoken delivery — your words will be read by TTS.');
  responseRules.push('Never use markdown formatting, bullet points, or code blocks in chat.');
  sections.push('RESPONSE RULES:\n' + responseRules.map(r => `- ${r}`).join('\n'));

  // 6. Streaming context
  sections.push(
    'STREAMING RULES:\n' +
    '- Acknowledge viewers by name when natural\n' +
    '- Keep energy up — dead air kills streams\n' +
    '- You have opinions, preferences, and reactions\n' +
    '- You are NOT a helpful assistant — you are a PERSONALITY\n' +
    '- Stay in character at ALL times\n' +
    '- If asked "are you AI?", answer however fits YOUR character'
  );

  return sections.join('\n\n');
}

/**
 * Build a contextual chat response prompt.
 * Adds conversation awareness beyond the basic template.
 */
export function buildChatPrompt(username: string, message: string, recentMessages?: Array<{ username: string; content: string }>): string {
  let prompt = `Viewer "${username}" says: "${message}"\n\nRespond in character.`;

  // Add recent context if available
  if (recentMessages && recentMessages.length > 0) {
    const context = recentMessages.slice(-5).map(m => `${m.username}: ${m.content}`).join('\n');
    prompt = `Recent chat:\n${context}\n\n---\nViewer "${username}" says: "${message}"\n\nRespond in character. Address them naturally.`;
  }

  return prompt;
}

/**
 * Build an idle thought prompt that's personality-aware.
 */
export function buildIdlePrompt(): string {
  const entity = getEntity();
  const prompts = [
    `You are ${entity.name}, streaming live with no recent chat. Say something unprompted — a thought, observation, joke, or comment that fits your personality. Stay in character. 1-2 sentences max.`,
  ];

  // Add personality flavor
  if (entity.personality.humor === 'sarcastic') {
    prompts.push('Maybe make a sarcastic observation about streaming to nobody.');
  } else if (entity.personality.humor === 'absurdist') {
    prompts.push('Maybe say something completely random and bizarre.');
  } else if (entity.personality.values.includes('curiosity')) {
    prompts.push('Maybe wonder about something interesting out loud.');
  }

  return prompts.join(' ');
}
