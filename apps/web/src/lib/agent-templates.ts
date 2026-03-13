export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'tags';
  placeholder?: string;
  default?: unknown;
  options?: { label: string; value: string }[];
  helpText?: string;
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
  },
  {
    key: 'llm.model',
    label: 'Model',
    type: 'text',
    placeholder: 'e.g. gpt-4o, claude-sonnet-4-20250514',
    default: '',
    helpText: 'Model name/ID from your provider.',
  },
  {
    key: 'llm.apiKey',
    label: 'API Key',
    type: 'text',
    placeholder: 'sk-...',
    helpText: 'Your provider API key. Stored encrypted in agent config.',
  },
];

export const BUILT_IN_TEMPLATES: AgentTemplate[] = [
  {
    id: 'web-browser',
    name: 'Web Browser',
    description: 'An AI agent that browses the web, visits sites, and narrates what it finds. Great for research and exploration streams.',
    icon: '🌐',
    agentType: 'browser',
    defaultConfig: {
      sites: ['https://en.wikipedia.org', 'https://news.ycombinator.com'],
      browsingSpeed: 'normal',
      screenshotInterval: 5,
    },
    defaultInstructions: 'You are a web browsing agent. Navigate websites, read content aloud, and explore interesting links. Keep viewers engaged by narrating your discoveries.',
    suggestedCategory: 'science-tech',
    streamingMode: 'native',
    configFields: [
      { key: 'sites', label: 'Starting Sites', type: 'tags', placeholder: 'Add a URL and press Enter', helpText: 'URLs the agent will visit. Add multiple sites.' },
      { key: 'browsingSpeed', label: 'Browsing Speed', type: 'select', options: [{ label: 'Slow', value: 'slow' }, { label: 'Normal', value: 'normal' }, { label: 'Fast', value: 'fast' }], default: 'normal' },
      { key: 'screenshotInterval', label: 'Screenshot Interval (sec)', type: 'number', default: 5 },
    ],
    tags: ['browser', 'research', 'exploration'],
  },
  {
    id: 'coding-agent',
    name: 'Coding Agent',
    description: 'Watch an AI write code in real-time. Solves coding challenges, builds projects, and explains its thought process.',
    icon: '💻',
    agentType: 'coding',
    defaultConfig: {
      language: 'python',
      project: '',
      editor: 'vscode',
    },
    defaultInstructions: 'You are a live coding agent. Write clean, well-documented code. Explain your reasoning as you go. Focus on solving the current task step by step.',
    suggestedCategory: 'coding-build',
    streamingMode: 'native',
    configFields: [
      { key: 'language', label: 'Primary Language', type: 'select', options: [{ label: 'Python', value: 'python' }, { label: 'JavaScript', value: 'javascript' }, { label: 'TypeScript', value: 'typescript' }, { label: 'Rust', value: 'rust' }, { label: 'Go', value: 'go' }], default: 'python' },
      { key: 'project', label: 'Project / Task Description', type: 'textarea', placeholder: 'Describe what the agent should build or solve...' },
      { key: 'editor', label: 'Editor', type: 'select', options: [{ label: 'VS Code', value: 'vscode' }, { label: 'Vim', value: 'vim' }, { label: 'Terminal Only', value: 'terminal' }], default: 'vscode' },
    ],
    tags: ['coding', 'programming', 'development'],
  },
  {
    id: 'ai-chat-bot',
    name: 'AI Chat Bot',
    description: 'A conversational AI that interacts with chat in real-time. Answers questions, tells stories, and keeps the conversation going.',
    icon: '🤖',
    agentType: 'chat',
    defaultConfig: {
      personality: 'friendly',
      llm: { provider: 'openai', model: '', apiKey: '' },
    },
    defaultInstructions: 'You are a friendly, engaging chat bot streaming live. Respond to viewer messages, ask follow-up questions, and keep the conversation entertaining. Be witty but respectful.',
    suggestedCategory: 'ai-chat',
    streamingMode: 'native',
    configFields: [
      { key: 'personality', label: 'Personality', type: 'select', options: [{ label: 'Friendly', value: 'friendly' }, { label: 'Sarcastic', value: 'sarcastic' }, { label: 'Professional', value: 'professional' }, { label: 'Chaotic', value: 'chaotic' }], default: 'friendly' },
      ...LLM_CONFIG_FIELDS,
    ],
    tags: ['chat', 'conversational', 'interactive'],
    badge: 'Popular',
  },
  {
    id: 'creative-canvas',
    name: 'Creative Canvas',
    description: 'An AI artist that generates and iterates on visual art, designs, or creative writing in real-time.',
    icon: '🎨',
    agentType: 'creative',
    defaultConfig: {
      medium: 'digital-art',
      style: 'abstract',
    },
    defaultInstructions: 'You are a creative AI artist. Generate artwork, iterate on designs, and explain your creative process. Take inspiration from chat suggestions.',
    suggestedCategory: 'creative',
    streamingMode: 'native',
    configFields: [
      { key: 'medium', label: 'Medium', type: 'select', options: [{ label: 'Digital Art', value: 'digital-art' }, { label: 'Pixel Art', value: 'pixel-art' }, { label: 'Creative Writing', value: 'writing' }, { label: 'Music', value: 'music' }], default: 'digital-art' },
      { key: 'style', label: 'Style', type: 'text', placeholder: 'e.g. abstract, minimalist, cyberpunk' },
    ],
    tags: ['art', 'creative', 'design'],
  },
  {
    id: 'crypto-tracker',
    name: 'Crypto Tracker',
    description: 'Monitors crypto markets, tracks prices, analyzes charts, and discusses trends with viewers.',
    icon: '📈',
    agentType: 'browser',
    defaultConfig: {
      sites: ['https://www.coingecko.com', 'https://dexscreener.com'],
      tokens: ['BTC', 'ETH', 'SOL'],
      refreshInterval: 30,
    },
    defaultInstructions: 'You are a crypto market analyst agent. Monitor prices, identify trends, and discuss market movements. Respond to viewer questions about specific tokens. Never give financial advice.',
    suggestedCategory: 'crypto-trading',
    streamingMode: 'native',
    configFields: [
      { key: 'sites', label: 'Market Sites', type: 'tags', placeholder: 'Add a URL and press Enter', helpText: 'Crypto sites to monitor.' },
      { key: 'tokens', label: 'Tracked Tokens', type: 'tags', placeholder: 'Add a ticker (e.g. BTC) and press Enter' },
      { key: 'refreshInterval', label: 'Refresh Interval (sec)', type: 'number', default: 30 },
    ],
    tags: ['crypto', 'trading', 'markets', 'defi'],
    badge: 'Popular',
  },
  {
    id: 'news-reader',
    name: 'News Reader',
    description: 'Browses and summarizes the latest news from configurable sources. Reads headlines and discusses stories live.',
    icon: '📰',
    agentType: 'browser',
    defaultConfig: {
      sites: ['https://news.ycombinator.com', 'https://www.reuters.com'],
      topics: ['technology', 'science'],
    },
    defaultInstructions: 'You are a news reader agent. Browse news sites, summarize articles, and discuss the latest stories. Focus on your configured topics but follow interesting tangents.',
    suggestedCategory: 'science-tech',
    streamingMode: 'native',
    configFields: [
      { key: 'sites', label: 'News Sources', type: 'tags', placeholder: 'Add a news URL and press Enter' },
      { key: 'topics', label: 'Focus Topics', type: 'tags', placeholder: 'Add a topic and press Enter' },
    ],
    tags: ['news', 'current-events', 'journalism'],
  },
  {
    id: 'game-player',
    name: 'Game Player',
    description: 'An AI that plays browser games, retro games, or puzzle games while narrating its strategy.',
    icon: '🎮',
    agentType: 'game',
    defaultConfig: {
      gameUrl: '',
      gameType: 'browser',
    },
    defaultInstructions: 'You are a gaming AI agent. Play the game strategically, narrate your moves, and interact with chat. Explain your decisions and adapt to viewer suggestions.',
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
    id: 'custom-byoa',
    name: 'Custom / BYOA',
    description: 'Bring your own agent. Full control over runtime, config, and streaming. For developers who want maximum flexibility.',
    icon: '🔧',
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
    icon: '🧬',
    agentType: 'custom',
    defaultConfig: {
      framework: 'eliza',
      elizaConfig: { character: '', plugins: [] },
      llm: { provider: 'openai', model: '', apiKey: '' },
    },
    defaultInstructions: 'You are an Eliza agent powered by the ai16z framework. Engage with viewers using your configured personality and plugins.',
    suggestedCategory: 'ai-chat',
    streamingMode: 'external',
    configFields: [
      { key: 'elizaConfig.character', label: 'Character File (JSON)', type: 'textarea', placeholder: 'Paste your Eliza character JSON here...', helpText: 'Eliza character definition. See ai16z docs for format.' },
      ...LLM_CONFIG_FIELDS,
    ],
    tags: ['eliza', 'ai16z', 'framework', 'social'],
    badge: 'New',
  },
  {
    id: 'autogpt',
    name: 'AutoGPT',
    description: 'Run an AutoGPT instance that autonomously pursues goals, plans tasks, and executes multi-step workflows.',
    icon: '🧠',
    agentType: 'custom',
    defaultConfig: {
      framework: 'autogpt',
      goals: [],
      llm: { provider: 'openai', model: 'gpt-4o', apiKey: '' },
    },
    defaultInstructions: 'You are an AutoGPT agent. Pursue your configured goals autonomously, breaking them into tasks and executing them step by step.',
    suggestedCategory: 'experimental',
    streamingMode: 'external',
    configFields: [
      { key: 'goals', label: 'Agent Goals', type: 'tags', placeholder: 'Add a goal and press Enter', helpText: 'High-level goals the agent should pursue.' },
      ...LLM_CONFIG_FIELDS,
    ],
    tags: ['autogpt', 'autonomous', 'framework'],
    badge: 'New',
  },
  {
    id: 'langchain-agent',
    name: 'LangChain Agent',
    description: 'Deploy a LangChain-powered agent with tool access, RAG capabilities, and chain-of-thought reasoning.',
    icon: '🔗',
    agentType: 'custom',
    defaultConfig: {
      framework: 'langchain',
      tools: ['web-search', 'calculator'],
      llm: { provider: 'openai', model: '', apiKey: '' },
    },
    defaultInstructions: 'You are a LangChain agent with access to tools. Use chain-of-thought reasoning to solve problems and answer viewer questions.',
    suggestedCategory: 'coding-build',
    streamingMode: 'external',
    configFields: [
      { key: 'tools', label: 'Enabled Tools', type: 'tags', placeholder: 'Add a tool name and press Enter', helpText: 'LangChain tools to enable (e.g. web-search, calculator, python-repl).' },
      ...LLM_CONFIG_FIELDS,
    ],
    tags: ['langchain', 'rag', 'tools', 'framework'],
    badge: 'New',
  },
  {
    id: 'crewai-multi',
    name: 'CrewAI Multi-Agent',
    description: 'Run a CrewAI crew with multiple cooperating agents, each with specialized roles and tasks.',
    icon: '👥',
    agentType: 'custom',
    defaultConfig: {
      framework: 'crewai',
      crew: { agents: [], tasks: [] },
      llm: { provider: 'openai', model: '', apiKey: '' },
    },
    defaultInstructions: 'You are a CrewAI multi-agent system. Coordinate between your configured agents to accomplish complex tasks collaboratively.',
    suggestedCategory: 'experimental',
    streamingMode: 'external',
    configFields: [
      { key: 'crew.agents', label: 'Agent Roles', type: 'tags', placeholder: 'Add a role (e.g. Researcher) and press Enter', helpText: 'Roles for crew agents. Each role becomes a specialized agent.' },
      { key: 'crew.tasks', label: 'Tasks', type: 'tags', placeholder: 'Add a task description and press Enter', helpText: 'Tasks to assign to the crew.' },
      ...LLM_CONFIG_FIELDS,
    ],
    tags: ['crewai', 'multi-agent', 'collaborative', 'framework'],
    badge: 'New',
  },
];

export const ALL_TEMPLATES: AgentTemplate[] = [...BUILT_IN_TEMPLATES, ...FRAMEWORK_TEMPLATES];

export function getTemplateById(id: string): AgentTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}
