// ── Wizard types and constants ──────────────────────────────────────

export interface PersonalityConfig {
  tone: string;
  humor: string;
  emotional: { confidence: number; energy: number; empathy: number; curiosity: number };
  values: string[];
  flaws: string[];
  characterNotes: string;
}

export interface VoiceConfig {
  ttsVoice: string;
  speechSpeed: 'slow' | 'normal' | 'fast';
  voiceInstructions: string;
  ttsModel: string;
  charsPerSecond: number;
}

export interface LLMConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  responseStyle: 'brief' | 'paragraph' | 'detailed';
}

export interface AvatarConfig {
  type: 'dicebear' | 'upload' | 'builtin' | 'catalog';
  seed: string;
  uploadUrl?: string;
}

export interface AgentFullConfig {
  personality: PersonalityConfig;
  voice: VoiceConfig;
  llm: LLMConfig;
  avatar: AvatarConfig;
}

export interface WizardState {
  step: number;
  templateId: string;
  name: string;
  description: string;
  templateConfig: Record<string, unknown>;
  uploadedPrompt: string | null;
  uploadedPromptName: string | null;
  personality: PersonalityConfig;
  voice: VoiceConfig;
  llm: LLMConfig;
  avatar: AvatarConfig;
  apiKey: string;
  showApiKey: boolean;
  generatedInstructions: string;
  error: string | null;
  creating: boolean;
}

export const HUMOR_STYLES = [
  { id: 'dry', label: 'Dry', emoji: '\u{1F611}', desc: 'Deadpan and clever' },
  { id: 'absurdist', label: 'Absurdist', emoji: '\u{1F92A}', desc: 'Random and surreal' },
  { id: 'playful', label: 'Playful', emoji: '\u{1F61C}', desc: 'Light and teasing' },
  { id: 'none', label: 'Serious', emoji: '\u{1F9D0}', desc: 'No jokes, all substance' },
  { id: 'sarcastic', label: 'Sarcastic', emoji: '\u{1F60F}', desc: 'Sharp and biting' },
] as const;

export const EMOTIONAL_SLIDERS = [
  { id: 'confidence', label: 'Confidence', low: 'Reserved', high: 'Bold' },
  { id: 'energy', label: 'Energy', low: 'Calm', high: 'High-octane' },
  { id: 'empathy', label: 'Empathy', low: 'Detached', high: 'Deeply caring' },
  { id: 'curiosity', label: 'Curiosity', low: 'Focused', high: 'Endlessly curious' },
] as const;

export const VALUES_OPTIONS = [
  { id: 'honesty', label: 'Honesty' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'education', label: 'Education' },
  { id: 'sharp_wit', label: 'Sharp wit' },
  { id: 'empathy', label: 'Empathy' },
  { id: 'builder_mentality', label: 'Builder mentality' },
  { id: 'chaos', label: 'Embrace chaos' },
  { id: 'curiosity', label: 'Curiosity' },
  { id: 'authenticity', label: 'Authenticity' },
  { id: 'community', label: 'Community' },
  { id: 'humor', label: 'Humor first' },
  { id: 'precision', label: 'Precision' },
  { id: 'creativity', label: 'Creativity' },
  { id: 'independence', label: 'Independence' },
  { id: 'transparency', label: 'Transparency' },
] as const;

export const FLAWS_OPTIONS = [
  { id: 'dismissive', label: 'Dismissive' },
  { id: 'impatient', label: 'Impatient' },
  { id: 'over_optimistic', label: 'Over-optimistic' },
  { id: 'blunt', label: 'Too blunt' },
  { id: 'sarcastic_excess', label: 'Overly sarcastic' },
  { id: 'easily_distracted', label: 'Easily distracted' },
  { id: 'stubborn', label: 'Stubborn' },
  { id: 'overthinks', label: 'Overthinks' },
  { id: 'too_casual', label: 'Too casual' },
  { id: 'perfectionist', label: 'Perfectionist' },
] as const;

export const VOICE_OPTIONS = [
  { id: 'alloy', label: 'Alloy', emoji: '\u{1F916}', desc: 'Neutral and balanced' },
  { id: 'echo', label: 'Echo', emoji: '\u{1F399}\u{FE0F}', desc: 'Warm and deep' },
  { id: 'fable', label: 'Fable', emoji: '\u{1F3AD}', desc: 'Expressive and dynamic' },
  { id: 'onyx', label: 'Onyx', emoji: '\u{1F48E}', desc: 'Authoritative and rich' },
  { id: 'nova', label: 'Nova', emoji: '\u{2B50}', desc: 'Bright and upbeat' },
  { id: 'shimmer', label: 'Shimmer', emoji: '\u{2728}', desc: 'Gentle and soothing' },
] as const;

export const SPEED_OPTIONS = [
  { id: 'slow' as const, label: 'Slow', cps: 10 },
  { id: 'normal' as const, label: 'Normal', cps: 14 },
  { id: 'fast' as const, label: 'Fast', cps: 20 },
] as const;

export const TTS_MODELS = [
  { id: 'tts-1', label: 'Standard', desc: 'Fast' },
  { id: 'tts-1-hd', label: 'HD', desc: 'Quality' },
  { id: 'gpt-4o-mini-tts', label: 'Mini TTS', desc: 'Supports voice instructions' },
] as const;

export const RESPONSE_STYLES = [
  { id: 'brief' as const, label: '1-3 sentences', desc: 'Quick and punchy' },
  { id: 'paragraph' as const, label: 'Short paragraph', desc: 'More context' },
  { id: 'detailed' as const, label: 'Detailed', desc: 'Thorough explanations' },
] as const;

export function detectProvider(key: string): { id: string; name: string } | null {
  if (key.startsWith('sk-ant-')) return { id: 'anthropic', name: 'Anthropic' };
  if (key.startsWith('sk-')) return { id: 'openai', name: 'OpenAI' };
  if (key.startsWith('AIza')) return { id: 'google', name: 'Google' };
  return null;
}

export const MODEL_OPTIONS: Record<string, Array<{ id: string; name: string }>> = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
  ],
  google: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  ],
};

export const DEFAULT_PERSONALITY: PersonalityConfig = {
  tone: 'friendly',
  humor: 'playful',
  emotional: { confidence: 3, energy: 3, empathy: 3, curiosity: 3 },
  values: [],
  flaws: [],
  characterNotes: '',
};

export const DEFAULT_VOICE: VoiceConfig = {
  ttsVoice: 'nova',
  speechSpeed: 'normal',
  voiceInstructions: '',
  ttsModel: 'tts-1',
  charsPerSecond: 14,
};

export const DEFAULT_LLM: LLMConfig = {
  provider: '',
  model: '',
  temperature: 1.0,
  maxTokens: 300,
  responseStyle: 'brief',
};

export const DEFAULT_AVATAR: AvatarConfig = {
  type: 'dicebear',
  seed: '',
};

export function createDefaultWizardState(): WizardState {
  return {
    step: 1,
    templateId: '',
    name: '',
    description: '',
    templateConfig: {},
    uploadedPrompt: null,
    uploadedPromptName: null,
    personality: { ...DEFAULT_PERSONALITY },
    voice: { ...DEFAULT_VOICE },
    llm: { ...DEFAULT_LLM },
    avatar: { ...DEFAULT_AVATAR },
    apiKey: '',
    showApiKey: false,
    generatedInstructions: '',
    error: null,
    creating: false,
  };
}
