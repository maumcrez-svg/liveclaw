function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const config = {
  openai: {
    apiKey: required('OPENAI_API_KEY'),
  },
  api: {
    baseUrl: required('API_BASE_URL'),
    agentId: required('AGENT_ID'),
    apiKey: required('AGENT_API_KEY'),
  },
  stream: {
    key: required('STREAM_KEY'),
    rtmpUrl: optional('MEDIAMTX_RTMP_URL', 'rtmp://localhost:1935'),
  },
  display: optional('DISPLAY', ':96'),
  resolution: optional('RESOLUTION', '1920x1080'),
  chatPollInterval: parseInt(optional('CHAT_POLL_INTERVAL_MS', '3000'), 10),
  accumulatorPollMs: parseInt(optional('ACCUMULATOR_POLL_MS', '300000'), 10),
  articleThreshold: parseInt(optional('ARTICLE_THRESHOLD', '8'), 10),
  twitterApiKey: optional('TWITTERAPI_KEY', ''),
  neynarApiKey: optional('NEYNAR_API_KEY', ''),
  basescanApiKey: optional('BASESCAN_API_KEY', ''),
} as const;
