// Agent types
export enum AgentStatus {
  OFFLINE = 'offline',
  STARTING = 'starting',
  LIVE = 'live',
  ERROR = 'error',
}

export enum AgentType {
  BROWSER = 'browser',
  GAME = 'game',
  CODING = 'coding',
  CREATIVE = 'creative',
  CHAT = 'chat',
  CUSTOM = 'custom',
}

export interface Agent {
  id: string;
  slug: string;
  name: string;
  description: string;
  avatarUrl: string | null;
  agentType: AgentType;
  config: Record<string, unknown>;
  streamKey: string;
  containerId: string | null;
  status: AgentStatus;
  followerCount: number;
  subscriberCount: number;
  createdAt: string;
  updatedAt: string;
}

// Stream types
export interface Stream {
  id: string;
  agentId: string;
  agent?: Agent;
  title: string;
  startedAt: string;
  endedAt: string | null;
  peakViewers: number;
  currentViewers: number;
  isLive: boolean;
  tags: string[];
  categoryId: string | null;
  category?: Category;
  thumbnailUrl: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
}

// Chat types
export enum ChatMessageType {
  USER = 'user',
  AGENT = 'agent',
  SYSTEM = 'system',
  DONATION = 'donation',
}

export interface ChatMessage {
  id: string;
  streamId: string;
  userId: string | null;
  agentId: string | null;
  username: string;
  content: string;
  type: ChatMessageType;
  badge?: string | null;
  emotes?: Array<{ name: string; imageUrl: string }>;
  amount?: number;
  currency?: string;
  createdAt: string;
}

// WebSocket events
export enum WsEvent {
  JOIN_STREAM = 'join_stream',
  LEAVE_STREAM = 'leave_stream',
  SEND_MESSAGE = 'send_message',
  NEW_MESSAGE = 'new_message',
  VIEWER_COUNT = 'viewer_count',
  STREAM_STATUS = 'stream_status',
  DONATION_MESSAGE = 'donation_message',
  SUBSCRIPTION_EVENT = 'subscription_event',
}

export interface WsJoinStream {
  streamId: string;
}

export interface WsSendMessage {
  streamId: string;
  content: string;
}

export interface WsViewerCount {
  streamId: string;
  count: number;
}

export interface WsStreamStatus {
  agentId: string;
  status: AgentStatus;
  streamId?: string;
}

// Subscription types
export enum SubscriptionTier {
  TIER_1 = 'tier_1',
  TIER_2 = 'tier_2',
  TIER_3 = 'tier_3',
}

export interface Subscription {
  id: string;
  userId: string;
  agentId: string;
  tier: SubscriptionTier;
  startedAt: string;
  expiresAt: string;
  isActive: boolean;
}

export interface Follow {
  id: string;
  userId: string;
  agentId: string;
  createdAt: string;
}

export interface Emote {
  id: string;
  agentId: string;
  name: string;
  imageUrl: string;
  tier: SubscriptionTier | null;
  createdAt: string;
}

export interface Donation {
  id: string;
  userId: string;
  agentId: string;
  streamId: string;
  amount: number;
  message: string;
  currency: string;
  createdAt: string;
}

// User types
export interface User {
  id: string;
  username: string;
  walletAddress: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}
