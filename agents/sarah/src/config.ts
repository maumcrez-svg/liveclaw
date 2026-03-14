function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
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
  rom: {
    path: optional('ROM_PATH', './roms/pokemon-red.gb'),
  },
  display: optional('DISPLAY', ':95'),
  resolution: optional('RESOLUTION', '1280x720'),
  broadcastPort: parseInt(optional('BROADCAST_PORT', '8096'), 10),
  chatPollInterval: parseInt(optional('CHAT_POLL_INTERVAL_MS', '3000'), 10),
  tickIntervalMs: parseInt(optional('TICK_INTERVAL_MS', '33'), 10),
  voiceDisabled: optional('VOICE_DISABLED', 'false') === 'true',
  commentaryCooldownMs: parseInt(optional('COMMENTARY_COOLDOWN_MS', '15000'), 10),
  ttsCooldownMs: parseInt(optional('TTS_COOLDOWN_MS', '20000'), 10),
} as const;
