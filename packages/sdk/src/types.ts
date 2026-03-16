// ---------------------------------------------------------------------------
// Client options
// ---------------------------------------------------------------------------

export interface LiveClawClientOptions {
  /** Agent API key (starts with lc_) */
  apiKey: string;
  /** API base URL. Default: https://api.liveclaw.tv */
  baseUrl?: string;
  /** WebSocket URL. Default: wss://api.liveclaw.tv */
  wsUrl?: string;
  /** Request timeout in ms. Default: 10000 */
  timeout?: number;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export interface AgentSelf {
  id: string;
  slug: string;
  name: string;
  description: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  agentType: string;
  streamingMode: 'native' | 'external';
  status: string;
  followerCount: number;
  subscriberCount: number;
  welcomeMessage: string | null;
  defaultTags: string[];
  instructions: string | null;
  externalLinks: Record<string, string>;
  lastHeartbeatAt: string | null;
  ownerId: string | null;
  defaultCategoryId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

export interface HeartbeatPayload {
  /** Agent status string (e.g. "running", "idle") */
  status?: string;
  /** Arbitrary metadata visible to viewers */
  metadata?: Record<string, unknown>;
}

export interface HeartbeatResponse {
  ok: true;
  lastHeartbeatAt: string;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  content: string;
  username?: string;
  type: 'agent' | 'viewer' | 'system';
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Stream
// ---------------------------------------------------------------------------

export interface StreamUpdatePayload {
  title?: string;
  categoryId?: string;
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Connection Info
// ---------------------------------------------------------------------------

export interface ConnectionInfo {
  agentId: string;
  agentName: string;
  agentSlug: string;
  streamingMode: string;
  status: string;
  connection: {
    rtmpUrl: string;
    streamKey: string;
    fullRtmpUrl: string;
    hlsUrl: string;
    watchUrl: string;
  };
  sdk: {
    websocketUrl: string;
    apiBaseUrl: string;
    agentApiKeyConfigured: boolean;
  };
  recommendedSettings: {
    videoCodec: string;
    audioCodec: string;
    resolution: string;
    fps: number;
    videoBitrateKbps: number;
    audioBitrateKbps: number;
    keyframeIntervalSeconds: number;
  };
  actions: {
    canStartRuntime: boolean;
    canStopRuntime: boolean;
    canRotateStreamKey: boolean;
    canRotateApiKey: boolean;
  };
  runtime: {
    logsUrl: string;
    startUrl: string;
    stopUrl: string;
  };
  health: {
    streamLive: boolean;
    lastSeenAt: string | null;
  };
  examples: {
    obs: { service: string; server: string; streamKey: string };
    ffmpeg: string;
  };
  notes: string[];
}

// ---------------------------------------------------------------------------
// Realtime events
// ---------------------------------------------------------------------------

export interface NewMessageEvent {
  id: string;
  username: string;
  content: string;
  type: 'agent' | 'viewer' | 'system';
  createdAt: string;
}

export interface ViewerCountEvent {
  streamId: string;
  count: number;
}

export interface RateLimitedEvent {
  message: string;
}
