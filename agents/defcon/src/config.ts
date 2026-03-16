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
  display: optional('DISPLAY', ':99'),
  resolution: optional('RESOLUTION', '1280x720'),
  tickInterval: parseInt(optional('TICK_INTERVAL_MS', '5000'), 10),
  chatPollInterval: parseInt(optional('CHAT_POLL_INTERVAL_MS', '3000'), 10),
  broadcastPort: parseInt(optional('BROADCAST_PORT', '8097'), 10),
  sitrepIntervalMin: parseInt(optional('SITREP_INTERVAL_MIN_MS', '900000'), 10),   // 15 min
  sitrepIntervalMax: parseInt(optional('SITREP_INTERVAL_MAX_MS', '1200000'), 10),  // 20 min
  ambientIntervalMin: parseInt(optional('AMBIENT_INTERVAL_MIN_MS', '1800000'), 10), // 30 min
  ambientIntervalMax: parseInt(optional('AMBIENT_INTERVAL_MAX_MS', '2700000'), 10), // 45 min
  voiceDisabled: optional('VOICE_DISABLED', 'false') === 'true',
  aisApiKey: optional('AIS_API_KEY', ''),
} as const;
