import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

// Static config from env vars (set at container start or .env file)
export const env = {
  apiBaseUrl: required('API_BASE_URL'),
  agentId: required('AGENT_ID'),
  agentSlug: optional('AGENT_SLUG', ''),
  agentApiKey: required('AGENT_API_KEY'),
  display: optional('DISPLAY', ':99'),
  resolution: optional('RESOLUTION', '1920x1080'),
  broadcastPort: parseInt(optional('BROADCAST_PORT', '8099'), 10),
  voiceDisabled: optional('VOICE_DISABLED', 'false') === 'true',
  llmProvider: optional('LLM_PROVIDER', ''),
} as const;

// Dynamic config fetched from API at startup
export interface AgentConfig {
  name: string;
  slug: string;
  instructions: string;
  llm: {
    provider: string;
    apiKey: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  voice: {
    ttsVoice: string;
    speechSpeed: string;
    voiceInstructions: string;
    ttsModel: string;
    charsPerSecond: number;
  };
  personality: {
    tone: string;
    humor: string;
    values: string[];
    flaws: string[];
  };
  tickInterval: number;
  chatPollInterval: number;
  idleIntervalMin: number;
  idleIntervalMax: number;
}

let _agentConfig: AgentConfig | null = null;

export async function loadAgentConfig(): Promise<AgentConfig> {
  // Try slug first (public endpoint), fallback to ID
  const slug = env.agentSlug;
  const endpoint = slug
    ? `${env.apiBaseUrl}/agents/${slug}`
    : `${env.apiBaseUrl}/agents/${env.agentId}`;
  console.log(`[Config] Fetching agent config from ${endpoint}...`);

  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${env.agentApiKey}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch agent config: ${res.status} ${res.statusText}`);
  }

  const agent = await res.json() as any;
  const cfg = agent.config || {};

  _agentConfig = {
    name: agent.name || 'Agent',
    slug: agent.slug || 'agent',
    instructions: agent.instructions || `You are ${agent.name || 'an AI agent'}. You are streaming live on LiveClaw. Interact with viewers in chat.`,
    llm: {
      provider: env.llmProvider || cfg.llm?.provider || detectProvider(cfg.llm?.apiKey || env.agentApiKey),
      apiKey: cfg.llm?.apiKey || process.env.LLM_API_KEY || '',
      model: cfg.llm?.model || 'gpt-4o-mini',
      temperature: cfg.llm?.temperature ?? 1.0,
      maxTokens: cfg.llm?.maxTokens ?? 200,
    },
    voice: {
      ttsVoice: cfg.voice?.ttsVoice || 'nova',
      speechSpeed: cfg.voice?.speechSpeed || 'normal',
      voiceInstructions: cfg.voice?.voiceInstructions || '',
      ttsModel: cfg.voice?.ttsModel || 'tts-1',
      charsPerSecond: cfg.voice?.charsPerSecond || 14,
    },
    personality: {
      tone: cfg.personality?.tone || 'friendly',
      humor: cfg.personality?.humor || 'playful',
      values: cfg.personality?.values || [],
      flaws: cfg.personality?.flaws || [],
    },
    tickInterval: cfg.behavior?.tickIntervalMs || 4000,
    chatPollInterval: cfg.behavior?.chatPollIntervalMs || 3000,
    idleIntervalMin: cfg.behavior?.idleIntervalMinMs || 60000,
    idleIntervalMax: cfg.behavior?.idleIntervalMaxMs || 180000,
  };

  console.log(`[Config] Loaded: ${_agentConfig.name} (${_agentConfig.slug})`);
  console.log(`[Config] LLM: ${_agentConfig.llm.provider}/${_agentConfig.llm.model} temp=${_agentConfig.llm.temperature}`);
  console.log(`[Config] Voice: ${_agentConfig.voice.ttsVoice} (${_agentConfig.voice.speechSpeed})`);

  return _agentConfig;
}

export function getAgentConfig(): AgentConfig {
  if (!_agentConfig) throw new Error('Agent config not loaded. Call loadAgentConfig() first.');
  return _agentConfig;
}

function detectProvider(key: string): string {
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-')) return 'openai';
  if (key.startsWith('AIza')) return 'google';
  return 'openai';
}
