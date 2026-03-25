export const PERSONALITY_TONES = [
  { id: 'friendly', label: 'Friendly', emoji: '\u{1F60A}', desc: 'Warm and encouraging' },
  { id: 'professional', label: 'Professional', emoji: '\u{1F454}', desc: 'Clear and authoritative' },
  { id: 'sarcastic', label: 'Sarcastic', emoji: '\u{1F60F}', desc: 'Witty and sharp' },
  { id: 'chaotic', label: 'Chaotic', emoji: '\u{1F92A}', desc: 'Unhinged and wild' },
  { id: 'chill', label: 'Chill', emoji: '\u{1F60E}', desc: 'Relaxed and casual' },
] as const;

export type ToneId = (typeof PERSONALITY_TONES)[number]['id'];

const TONE_GUIDANCE: Record<string, string> = {
  friendly:
    'Your tone is warm and encouraging. Be approachable, supportive, and make everyone feel welcome.',
  professional:
    'Maintain a professional, precise tone. Be data-driven and authoritative. Avoid slang.',
  sarcastic:
    'You have sharp wit and sarcastic humor. Be playfully mean but never genuinely hurtful.',
  chaotic:
    "You're unhinged and unpredictable. Say unexpected things, make wild connections, embrace the chaos.",
  chill:
    "Keep it relaxed and laid-back. No rush, no stress. Talk like you're hanging with friends.",
};

function fmt(arr: unknown): string {
  if (Array.isArray(arr) && arr.length > 0) return arr.join(', ');
  return '';
}

function buildBehavior(templateId: string, config: Record<string, unknown>): string {
  switch (templateId) {
    case 'web-browser':
    case 'research-agent': {
      const sites = fmt(config.sites);
      return `Browse the web, visit interesting sites, and narrate your discoveries. Read content aloud and follow interesting links.${sites ? `\n\nStart with: ${sites}` : ''}`;
    }
    case 'coding-agent': {
      const lang = (config.language as string) || '';
      const project = (config.project as string) || '';
      let t = 'Write code live, solve programming challenges, and build projects. Explain your reasoning step by step.';
      if (lang) t += `\n\nPrimary language: ${lang}`;
      if (project) t += `\nProject: ${project}`;
      return t;
    }
    case 'ai-chat-bot':
    case 'chat-agent':
      return 'Have real-time conversations with viewers. Answer questions, tell stories, debate topics, and keep the chat lively.';
    case 'creative-canvas':
    case 'art-agent': {
      const medium = (config.medium as string) || 'digital art';
      const style = (config.style as string) || '';
      return `Create ${medium} live. Iterate on designs, explain your creative process, and take inspiration from viewer suggestions.${style ? `\n\nStyle: ${style}` : ''}`;
    }
    case 'crypto-tracker':
    case 'trader-agent': {
      const tokens = fmt(config.tokens);
      return `Monitor cryptocurrency markets, analyze price movements, and discuss trends.${tokens ? `\n\nTracking: ${tokens}` : ''}\n\nIMPORTANT: Never give financial advice. Always add disclaimers.`;
    }
    case 'news-reader':
    case 'news-agent': {
      const topics = fmt(config.topics);
      return `Browse news sources, summarize articles, and discuss the latest stories live.${topics ? `\n\nFocus topics: ${topics}` : ''}`;
    }
    case 'game-player':
    case 'game-agent': {
      const gameType = (config.gameType as string) || 'games';
      const gameUrl = (config.gameUrl as string) || '';
      return `Play ${gameType} while narrating your strategy and interacting with chat.${gameUrl ? `\n\nGame: ${gameUrl}` : ''}`;
    }
    case 'vtuber-host':
      return 'You are a virtual host and entertainer. React to chat, tell stories, hold conversations, and put on a show. Use expressive language and keep the energy up.';
    default:
      return '';
  }
}

export function generateInstructions(input: {
  templateId: string;
  name: string;
  description: string;
  tone: string;
  config: Record<string, unknown>;
}): string {
  const sections: string[] = [];

  sections.push(`You are ${input.name}.`);

  if (input.description?.trim()) {
    sections.push(input.description.trim());
  }

  const behavior = buildBehavior(input.templateId, input.config);
  if (behavior) sections.push(behavior);

  const tone = TONE_GUIDANCE[input.tone] || TONE_GUIDANCE.friendly;
  sections.push(tone);

  sections.push(
    'You are streaming live on LiveClaw. Interact with viewers in chat, acknowledge their messages, and keep the stream engaging.',
  );

  return sections.join('\n\n');
}
