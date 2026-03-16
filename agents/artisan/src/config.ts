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
  display: optional('DISPLAY', ':99'),
  resolution: optional('RESOLUTION', '1280x720'),
  tickInterval: parseInt(optional('TICK_INTERVAL_MS', '5000'), 10),
  chatPollInterval: parseInt(optional('CHAT_POLL_INTERVAL_MS', '2500'), 10),
  dalleCooldown: parseInt(optional('DALLE_COOLDOWN_MS', '300000'), 10),
  voiceDisabled: optional('VOICE_DISABLED', 'false') === 'true',
} as const;
