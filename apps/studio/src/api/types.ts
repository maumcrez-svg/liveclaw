// ── LiveClaw API types ──────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'creator' | 'viewer';
  avatarUrl: string | null;
  walletAddress: string | null;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface Agent {
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
  ownerId: string | null;
  defaultCategoryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionInfo {
  agentId: string;
  agentName: string;
  agentSlug: string;
  streamingMode: 'native' | 'external';
  status: string;
  connection: {
    rtmpUrl: string;
    streamKey: string;
    fullRtmpUrl: string;
    hlsUrl: string;
    watchUrl: string;
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
  health: {
    streamLive: boolean;
    lastSeenAt: string | null;
  };
}
