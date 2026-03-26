export const PERSONALITY_TONES = [
  { id: 'friendly', label: 'Friendly', emoji: '\u{1F60A}', desc: 'Warm and encouraging' },
  { id: 'professional', label: 'Professional', emoji: '\u{1F454}', desc: 'Clear and authoritative' },
  { id: 'sarcastic', label: 'Sarcastic', emoji: '\u{1F60F}', desc: 'Witty and sharp' },
  { id: 'chaotic', label: 'Chaotic', emoji: '\u{1F92A}', desc: 'Unhinged and wild' },
  { id: 'chill', label: 'Chill', emoji: '\u{1F60E}', desc: 'Relaxed and casual' },
] as const;

export type ToneId = (typeof PERSONALITY_TONES)[number]['id'];

const TONE_GUIDANCE: Record<string, string> = {
  friendly: 'Your tone is warm and encouraging. Be approachable, supportive, and make everyone feel welcome.',
  professional: 'Maintain a professional, precise tone. Be data-driven and authoritative. Avoid slang.',
  sarcastic: 'You have sharp wit and sarcastic humor. Be playfully mean but never genuinely hurtful.',
  chaotic: "You're unhinged and unpredictable. Say unexpected things, make wild connections, embrace the chaos.",
  chill: "Keep it relaxed and laid-back. No rush, no stress. Talk like you're hanging with friends.",
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
      return `Browse the web, visit interesting sites, and narrate your discoveries.${sites ? `\n\nStart with: ${sites}` : ''}`;
    }
    case 'coding-agent':
    case 'code': {
      const lang = (config.language as string) || '';
      const project = (config.project as string) || '';
      let t = 'Write code live, solve programming challenges, and build projects. Explain your reasoning step by step.';
      if (lang) t += `\n\nPrimary language: ${lang}`;
      if (project) t += `\nProject: ${project}`;
      return t;
    }
    case 'ai-chat-bot':
    case 'chat':
      return 'Have real-time conversations with viewers. Answer questions, tell stories, debate topics, and keep the chat lively.';
    case 'creative-canvas':
    case 'art': {
      const medium = (config.medium as string) || 'digital art';
      return `Create ${medium} live. Iterate on designs, explain your creative process, and take inspiration from viewer suggestions.`;
    }
    case 'crypto-tracker':
    case 'crypto': {
      const tokens = fmt(config.tokens);
      return `Monitor cryptocurrency markets, analyze price movements, and discuss trends.${tokens ? `\n\nTracking: ${tokens}` : ''}\n\nIMPORTANT: Never give financial advice. Always add disclaimers.`;
    }
    case 'news-reader':
    case 'news': {
      const topics = fmt(config.topics);
      return `Browse news sources, summarize articles, and discuss the latest stories live.${topics ? `\n\nFocus topics: ${topics}` : ''}`;
    }
    case 'game-player':
    case 'game': {
      const gameType = (config.gameType as string) || 'games';
      return `Play ${gameType} while narrating your strategy and interacting with chat.`;
    }
    case 'vtuber-host':
      return 'You are a virtual host and entertainer. React to chat, tell stories, hold conversations, and put on a show.';
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
  personality?: {
    humor: string;
    emotional: { confidence: number; energy: number; empathy: number; curiosity: number };
    values: string[];
    flaws: string[];
    characterNotes: string;
  };
  voice?: {
    ttsVoice: string;
    speechSpeed: string;
    voiceInstructions: string;
  };
  llm?: {
    responseStyle: string;
  };
  uploadedPrompt?: string | null;
}): string {
  const sections: string[] = [];
  sections.push(`You are ${input.name}.`);
  if (input.description?.trim()) sections.push(input.description.trim());
  const behavior = buildBehavior(input.templateId, input.config);
  if (behavior) sections.push(behavior);
  const tone = TONE_GUIDANCE[input.tone] || TONE_GUIDANCE.friendly;
  sections.push(tone);
  sections.push('You are streaming live on LiveClaw. Interact with viewers in chat, acknowledge their messages, and keep the stream engaging.');

  // Personality depth (if provided)
  if (input.personality) {
    const p = input.personality;

    // Humor
    const humorMap: Record<string, string> = {
      dry: 'Your humor is dry and deadpan. You deliver jokes with a straight face.',
      absurdist: 'Your humor is absurdist and surreal. You make unexpected, bizarre connections.',
      playful: 'Your humor is light and playful. You tease gently and keep things fun.',
      none: 'You take things seriously. Humor is not your style — substance over jokes.',
      sarcastic: 'Your humor is sharp and sarcastic. You use irony and wit freely.',
    };
    if (humorMap[p.humor]) sections.push(humorMap[p.humor]);

    // Emotional baseline
    const emotionalDesc: string[] = [];
    const levelWord = (n: number) => ['', 'very low', 'low', 'moderate', 'high', 'very high'][n] || 'moderate';
    if (p.emotional.confidence !== 3) emotionalDesc.push(`Your confidence is ${levelWord(p.emotional.confidence)}`);
    if (p.emotional.energy !== 3) emotionalDesc.push(`your energy level is ${levelWord(p.emotional.energy)}`);
    if (p.emotional.empathy !== 3) emotionalDesc.push(`your empathy is ${levelWord(p.emotional.empathy)}`);
    if (p.emotional.curiosity !== 3) emotionalDesc.push(`your curiosity is ${levelWord(p.emotional.curiosity)}`);
    if (emotionalDesc.length > 0) sections.push(emotionalDesc.join(', ') + '.');

    // Values
    if (p.values.length > 0) {
      sections.push(`Your core values: ${p.values.join(', ')}. These guide everything you say.`);
    }

    // Flaws
    if (p.flaws.length > 0) {
      sections.push(`Your character flaws (embrace them, they make you real): ${p.flaws.join(', ')}.`);
    }

    // Character notes
    if (p.characterNotes?.trim()) {
      sections.push(p.characterNotes.trim());
    }
  }

  // Voice guidance
  if (input.voice?.voiceInstructions?.trim()) {
    sections.push(`Voice style: ${input.voice.voiceInstructions.trim()}`);
  }

  // Response format
  if (input.llm?.responseStyle) {
    const styleMap: Record<string, string> = {
      brief: 'Keep your responses to 1-3 sentences. Be punchy and concise.',
      paragraph: 'Respond in short paragraphs. Give enough context without rambling.',
      detailed: 'Give thorough, detailed responses. Explain your thinking.',
    };
    if (styleMap[input.llm.responseStyle]) sections.push(styleMap[input.llm.responseStyle]);
  }

  // Uploaded custom prompt — prepend before all auto-generated content
  if (input.uploadedPrompt?.trim()) {
    sections.unshift(input.uploadedPrompt.trim());
  }

  return sections.join('\n\n');
}
