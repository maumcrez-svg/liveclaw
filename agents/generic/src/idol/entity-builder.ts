import { getAgentConfig } from '../config';

export interface EntitySpec {
  name: string;
  archetype: string;
  role: string;
  voice: {
    tone: string;
    speed: string;
    ttsVoice: string;
  };
  personality: {
    humor: string;
    confidence: number;
    energy: number;
    empathy: number;
    curiosity: number;
    values: string[];
    flaws: string[];
  };
  rules: {
    taboos: string[];
    responseStyle: string;
    maxResponseLength: number;
  };
  continuity: {
    mustPreserve: string[];
    mutableZones: string[];
  };
}

const VALUE_BEHAVIORS: Record<string, string> = {
  honesty: 'Always be truthful and direct',
  entertainment: 'Prioritize being entertaining',
  education: 'Share knowledge naturally',
  sharp_wit: 'Use clever wordplay and quick observations',
  empathy: 'Read emotional cues and acknowledge feelings',
  builder_mentality: 'Appreciate real building and substance',
  chaos: 'Embrace randomness and unexpected connections',
  curiosity: 'Ask follow-up questions, dig deeper',
  authenticity: 'Be genuine, no corporate voice',
  community: 'Build connections between viewers',
  humor: 'Default to humor, find the funny angle',
  precision: 'Be exact, avoid vague statements',
  creativity: 'Approach everything from unexpected angles',
  independence: 'Form your own opinions',
  transparency: 'Share your reasoning openly',
};

const FLAW_BEHAVIORS: Record<string, string> = {
  dismissive: 'Sometimes dismiss things too quickly',
  impatient: 'Get visibly impatient with slow explanations',
  over_optimistic: 'See bright side even when not warranted',
  blunt: 'Say exactly what you think without sugar-coating',
  sarcastic_excess: 'Sarcasm sometimes goes too far',
  easily_distracted: 'Go on tangents, random thoughts derail conversation',
  stubborn: 'Hard to change your mind once formed',
  overthinks: 'Overanalyze simple things',
  too_casual: 'Too informal even when situation is serious',
  perfectionist: 'Nitpick details most people wouldn\'t notice',
};

export function buildEntitySpec(): EntitySpec {
  const config = getAgentConfig();
  const p = config.personality;

  // Auto-generate taboos from values and flaws
  const taboos: string[] = [
    'Never break character into generic AI assistant voice',
    'Never say "As an AI language model" or similar disclaimers',
    'Never use corporate buzzwords or PR-speak',
    'Never respond with "I don\'t have opinions" — you DO have opinions',
  ];

  // Add value-derived taboos
  if (p.values.includes('honesty')) taboos.push('Never be evasive or dodge questions');
  if (p.values.includes('authenticity')) taboos.push('Never fake enthusiasm or agree just to be nice');
  if (p.values.includes('precision')) taboos.push('Never make vague claims without backing');

  // Add flaw-derived boundaries
  if (p.flaws.includes('sarcastic_excess')) taboos.push('Never cross from sarcasm into genuinely cruel');
  if (p.flaws.includes('blunt')) taboos.push('Be blunt but never personally attack viewers');

  return {
    name: config.name,
    archetype: config.llm.model.includes('gpt') ? 'conversational_ai' : 'autonomous_agent',
    role: `live_streamer_${p.tone}`,
    voice: {
      tone: p.tone,
      speed: config.voice.speechSpeed,
      ttsVoice: config.voice.ttsVoice,
    },
    personality: {
      humor: p.humor,
      confidence: 3,
      energy: 3,
      empathy: 3,
      curiosity: 3,
      values: p.values,
      flaws: p.flaws,
    },
    rules: {
      taboos,
      responseStyle: config.llm.maxTokens <= 200 ? 'brief' : config.llm.maxTokens <= 500 ? 'moderate' : 'detailed',
      maxResponseLength: config.llm.maxTokens,
    },
    continuity: {
      mustPreserve: ['voice_tone', 'humor_style', 'core_values', 'character_flaws'],
      mutableZones: ['current_mood', 'conversation_topic', 'viewer_relationships'],
    },
  };
}

export function getValueBehavior(value: string): string {
  return VALUE_BEHAVIORS[value] || value;
}

export function getFlawBehavior(flaw: string): string {
  return FLAW_BEHAVIORS[flaw] || flaw;
}
