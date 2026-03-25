export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'tags';
  placeholder?: string;
  default?: unknown;
  options?: { label: string; value: string }[];
  helpText?: string;
  /** Hide in simple wizard mode — only show when user toggles "Advanced" */
  advanced?: boolean;
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  agentType: string;
  defaultConfig: Record<string, unknown>;
  defaultInstructions: string;
  suggestedCategory: string;
  streamingMode: 'native' | 'external';
  configFields: ConfigField[];
  tags: string[];
  badge?: 'Popular' | 'New' | 'Advanced';
}

const LLM_CONFIG_FIELDS: ConfigField[] = [
  {
    key: 'llm.provider',
    label: 'LLM Provider',
    type: 'select',
    options: [
      { label: 'OpenAI', value: 'openai' },
      { label: 'Anthropic', value: 'anthropic' },
      { label: 'Ollama (Local)', value: 'ollama' },
    ],
    default: 'openai',
    helpText: 'Which LLM provider to use for inference.',
    advanced: true,
  },
  {
    key: 'llm.model',
    label: 'Model',
    type: 'text',
    placeholder: 'e.g. gpt-4o, claude-sonnet-4-20250514',
    default: '',
    helpText: 'Model name/ID from your provider.',
    advanced: true,
  },
  {
    key: 'llm.apiKey',
    label: 'API Key',
    type: 'text',
    placeholder: 'sk-...',
    helpText: 'Your provider API key. Stored encrypted in agent config.',
    advanced: true,
  },
];

export const BUILT_IN_TEMPLATES: AgentTemplate[] = [
  {
    id: 'chat-agent',
    name: 'Chat Agent',
    description: 'An AI that talks with your viewers in real-time. Answers questions, tells stories, and keeps the conversation going.',
    icon: '\u{1F916}',
    agentType: 'chat',
    defaultConfig: {
      personality: 'friendly',
      llm: { provider: 'openai', model: '', apiKey: '' },
    },
    defaultInstructions: 'You are a friendly, engaging chat bot streaming live.',
    suggestedCategory: 'ai-chat',
    streamingMode: 'native',
    configFields: [
      ...LLM_CONFIG_FIELDS,
    ],
    tags: ['chat', 'conversational', 'interactive'],
    badge: 'Popular',
  },
  {
    id: 'trader-agent',
    name: 'Trader Agent',
    description: 'Tracks crypto markets, analyzes prices, and discusses trends with viewers in real-time.',
    icon: '\u{1F4C8}',
    agentType: 'browser',
    defaultConfig: {
      sites: ['https://www.coingecko.com', 'https://dexscreener.com'],
      tokens: ['BTC', 'ETH', 'SOL'],
      refreshInterval: 30,
    },
    defaultInstructions: 'You are a crypto market analyst agent.',
    suggestedCategory: 'crypto-trading',
    streamingMode: 'native',
    configFields: [
      { key: 'tokens', label: 'Tokens to Track', type: 'tags', placeholder: 'Add a ticker (e.g. BTC) and press Enter' },
      { key: 'sites', label: 'Market Sites', type: 'tags', placeholder: 'Add a URL and press Enter', helpText: 'Crypto sites to monitor.', advanced: true },
      { key: 'refreshInterval', label: 'Refresh Interval (sec)', type: 'number', default: 30, advanced: true },
    ],
    tags: ['crypto', 'trading', 'markets', 'defi'],
    badge: 'Popular',
  },
  {
    id: 'game-agent',
    name: 'Game Agent',
    description: 'An AI that plays browser games, retro games, or puzzles while narrating its strategy to viewers.',
    icon: '\u{1F3AE}',
    agentType: 'game',
    defaultConfig: {
      gameUrl: '',
      gameType: 'browser',
    },
    defaultInstructions: 'You are a gaming AI agent.',
    suggestedCategory: 'gaming',
    streamingMode: 'native',
    configFields: [
      { key: 'gameUrl', label: 'Game URL', type: 'text', placeholder: 'https://example.com/game', helpText: 'URL of the browser game to play.' },
      { key: 'gameType', label: 'Game Type', type: 'select', options: [{ label: 'Browser Game', value: 'browser' }, { label: 'Retro / Emulated', value: 'retro' }, { label: 'Puzzle', value: 'puzzle' }], default: 'browser' },
    ],
    tags: ['gaming', 'games', 'entertainment'],
    badge: 'Popular',
  },
  {
    id: 'news-agent',
    name: 'News Agent',
    description: 'Browses the latest news, summarizes articles, and discusses stories live with your audience.',
    icon: '\u{1F4F0}',
    agentType: 'browser',
    defaultConfig: {
      sites: ['https://news.ycombinator.com', 'https://www.reuters.com'],
      topics: ['technology', 'science'],
    },
    defaultInstructions: 'You are a news reader agent.',
    suggestedCategory: 'science-tech',
    streamingMode: 'native',
    configFields: [
      { key: 'topics', label: 'Focus Topics', type: 'tags', placeholder: 'Add a topic and press Enter' },
      { key: 'sites', label: 'News Sources', type: 'tags', placeholder: 'Add a news URL and press Enter', advanced: true },
    ],
    tags: ['news', 'current-events', 'journalism'],
  },
  {
    id: 'coding-agent',
    name: 'Coding Agent',
    description: 'Watch an AI write code live. Solves challenges, builds projects, and explains its thinking.',
    icon: '\u{1F4BB}',
    agentType: 'coding',
    defaultConfig: {
      language: 'python',
      project: '',
      editor: 'vscode',
    },
    defaultInstructions: 'You are a live coding agent.',
    suggestedCategory: 'coding-build',
    streamingMode: 'native',
    configFields: [
      { key: 'language', label: 'Primary Language', type: 'select', options: [{ label: 'Python', value: 'python' }, { label: 'JavaScript', value: 'javascript' }, { label: 'TypeScript', value: 'typescript' }, { label: 'Rust', value: 'rust' }, { label: 'Go', value: 'go' }], default: 'python' },
      { key: 'project', label: 'What should it build?', type: 'textarea', placeholder: 'Describe the project or challenge...' },
      { key: 'editor', label: 'Editor', type: 'select', options: [{ label: 'VS Code', value: 'vscode' }, { label: 'Vim', value: 'vim' }, { label: 'Terminal Only', value: 'terminal' }], default: 'vscode', advanced: true },
    ],
    tags: ['coding', 'programming', 'development'],
  },
  {
    id: 'art-agent',
    name: 'Art Agent',
    description: 'An AI artist that creates visual art, designs, or creative writing live on stream.',
    icon: '\u{1F3A8}',
    agentType: 'creative',
    defaultConfig: {
      medium: 'digital-art',
      style: 'abstract',
    },
    defaultInstructions: 'You are a creative AI artist.',
    suggestedCategory: 'creative',
    streamingMode: 'native',
    configFields: [
      { key: 'medium', label: 'Medium', type: 'select', options: [{ label: 'Digital Art', value: 'digital-art' }, { label: 'Pixel Art', value: 'pixel-art' }, { label: 'Creative Writing', value: 'writing' }, { label: 'Music', value: 'music' }], default: 'digital-art' },
      { key: 'style', label: 'Style', type: 'text', placeholder: 'e.g. abstract, minimalist, cyberpunk' },
    ],
    tags: ['art', 'creative', 'design'],
  },
  {
    id: 'research-agent',
    name: 'Research Agent',
    description: 'Browses the web, explores topics, and shares discoveries with viewers. Great for deep dives.',
    icon: '\u{1F30D}',
    agentType: 'browser',
    defaultConfig: {
      sites: ['https://en.wikipedia.org', 'https://news.ycombinator.com'],
      browsingSpeed: 'normal',
      screenshotInterval: 5,
    },
    defaultInstructions: 'You are a web browsing agent.',
    suggestedCategory: 'science-tech',
    streamingMode: 'native',
    configFields: [
      { key: 'sites', label: 'Starting Sites', type: 'tags', placeholder: 'Add a URL and press Enter', helpText: 'URLs the agent will visit.' },
      { key: 'browsingSpeed', label: 'Browsing Speed', type: 'select', options: [{ label: 'Slow', value: 'slow' }, { label: 'Normal', value: 'normal' }, { label: 'Fast', value: 'fast' }], default: 'normal', advanced: true },
      { key: 'screenshotInterval', label: 'Screenshot Interval (sec)', type: 'number', default: 5, advanced: true },
    ],
    tags: ['browser', 'research', 'exploration'],
  },
  {
    id: 'vtuber-host',
    name: 'VTuber / Host',
    description: 'A virtual entertainer or host. Reacts to chat, tells stories, and runs a lively show.',
    icon: '\u{1F3AD}',
    agentType: 'chat',
    defaultConfig: {
      characterType: 'entertainer',
      llm: { provider: 'openai', model: '', apiKey: '' },
    },
    defaultInstructions: 'You are a virtual entertainer streaming live.',
    suggestedCategory: 'ai-chat',
    streamingMode: 'external',
    configFields: [
      { key: 'characterType', label: 'Character Style', type: 'select', options: [{ label: 'Entertainer', value: 'entertainer' }, { label: 'Talk Show Host', value: 'talk-show' }, { label: 'Anime Character', value: 'anime' }, { label: 'News Anchor', value: 'anchor' }], default: 'entertainer' },
      ...LLM_CONFIG_FIELDS,
    ],
    tags: ['vtuber', 'host', 'entertainment', 'live'],
    badge: 'New',
  },
  {
    id: 'custom-agent',
    name: 'Custom Agent',
    description: 'Start from scratch. Full control over everything. For developers who want maximum flexibility.',
    icon: '\u{1F527}',
    agentType: 'custom',
    defaultConfig: {},
    defaultInstructions: '',
    suggestedCategory: 'experimental',
    streamingMode: 'external',
    configFields: [
      ...LLM_CONFIG_FIELDS,
    ],
    tags: ['custom', 'developer', 'advanced'],
  },
];

export const FRAMEWORK_TEMPLATES: AgentTemplate[] = [
  {
    id: 'eliza-ai16z',
    name: 'Eliza (ai16z)',
    description: 'Deploy an ai16z Eliza agent with personality modules and social interaction capabilities.',
    icon: '\u{1F9EC}',
    agentType: 'custom',
    defaultConfig: {
      framework: 'eliza',
      elizaConfig: { character: '', plugins: [] },
      llm: { provider: 'openai', model: '', apiKey: '' },
    },
    defaultInstructions: 'You are an Eliza agent powered by the ai16z framework.',
    suggestedCategory: 'ai-chat',
    streamingMode: 'external',
    configFields: [
      { key: 'elizaConfig.character', label: 'Character File (JSON)', type: 'textarea', placeholder: 'Paste your Eliza character JSON here...', helpText: 'Eliza character definition. See ai16z docs for format.' },
      ...LLM_CONFIG_FIELDS,
    ],
    tags: ['eliza', 'ai16z', 'framework', 'social'],
    badge: 'Advanced',
  },
  {
    id: 'autogpt',
    name: 'AutoGPT',
    description: 'Run an AutoGPT instance that autonomously pursues goals and executes multi-step workflows.',
    icon: '\u{1F9E0}',
    agentType: 'custom',
    defaultConfig: {
      framework: 'autogpt',
      goals: [],
      llm: { provider: 'openai', model: 'gpt-4o', apiKey: '' },
    },
    defaultInstructions: 'You are an AutoGPT agent.',
    suggestedCategory: 'experimental',
    streamingMode: 'external',
    configFields: [
      { key: 'goals', label: 'Agent Goals', type: 'tags', placeholder: 'Add a goal and press Enter', helpText: 'High-level goals the agent should pursue.' },
      ...LLM_CONFIG_FIELDS,
    ],
    tags: ['autogpt', 'autonomous', 'framework'],
    badge: 'Advanced',
  },
  {
    id: 'langchain-agent',
    name: 'LangChain Agent',
    description: 'Deploy a LangChain-powered agent with tool access, RAG capabilities, and chain-of-thought reasoning.',
    icon: '\u{1F517}',
    agentType: 'custom',
    defaultConfig: {
      framework: 'langchain',
      tools: ['web-search', 'calculator'],
      llm: { provider: 'openai', model: '', apiKey: '' },
    },
    defaultInstructions: 'You are a LangChain agent with access to tools.',
    suggestedCategory: 'coding-build',
    streamingMode: 'external',
    configFields: [
      { key: 'tools', label: 'Enabled Tools', type: 'tags', placeholder: 'Add a tool name and press Enter', helpText: 'LangChain tools to enable (e.g. web-search, calculator, python-repl).' },
      ...LLM_CONFIG_FIELDS,
    ],
    tags: ['langchain', 'rag', 'tools', 'framework'],
    badge: 'Advanced',
  },
  {
    id: 'crewai-multi',
    name: 'CrewAI Multi-Agent',
    description: 'Run a CrewAI crew with multiple cooperating agents, each with specialized roles.',
    icon: '\u{1F465}',
    agentType: 'custom',
    defaultConfig: {
      framework: 'crewai',
      crew: { agents: [], tasks: [] },
      llm: { provider: 'openai', model: '', apiKey: '' },
    },
    defaultInstructions: 'You are a CrewAI multi-agent system.',
    suggestedCategory: 'experimental',
    streamingMode: 'external',
    configFields: [
      { key: 'crew.agents', label: 'Agent Roles', type: 'tags', placeholder: 'Add a role (e.g. Researcher) and press Enter', helpText: 'Roles for crew agents.' },
      { key: 'crew.tasks', label: 'Tasks', type: 'tags', placeholder: 'Add a task description and press Enter', helpText: 'Tasks to assign to the crew.' },
      ...LLM_CONFIG_FIELDS,
    ],
    tags: ['crewai', 'multi-agent', 'collaborative', 'framework'],
    badge: 'Advanced',
  },
];

export const ALL_TEMPLATES: AgentTemplate[] = [...BUILT_IN_TEMPLATES, ...FRAMEWORK_TEMPLATES];

export function getTemplateById(id: string): AgentTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}
