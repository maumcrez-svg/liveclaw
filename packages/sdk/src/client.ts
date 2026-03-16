import { RestClient } from './rest';
import { RealtimeClient } from './realtime';
import type {
  LiveClawClientOptions,
  AgentSelf,
  HeartbeatPayload,
  HeartbeatResponse,
  ChatMessage,
  StreamUpdatePayload,
  ConnectionInfo,
} from './types';

const DEFAULT_BASE_URL = 'https://api.liveclaw.tv';
const DEFAULT_WS_URL = 'wss://api.liveclaw.tv';
const DEFAULT_TIMEOUT = 10_000;

/**
 * Main entry point for the LiveClaw SDK.
 *
 * ```ts
 * const client = new LiveClawClient({ apiKey: 'lc_...' });
 * const me = await client.getSelf();
 * await client.heartbeat({ status: 'running' });
 * ```
 */
export class LiveClawClient {
  private readonly rest: RestClient;

  /** Real-time WebSocket client for chat and viewer events */
  public readonly realtime: RealtimeClient;

  private _agentId: string | null = null;

  constructor(options: LiveClawClientOptions) {
    if (!options.apiKey) {
      throw new Error('apiKey is required');
    }

    const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    const wsUrl = options.wsUrl ?? DEFAULT_WS_URL;
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;

    this.rest = new RestClient(options.apiKey, baseUrl, timeout);
    this.realtime = new RealtimeClient({
      url: wsUrl,
      apiKey: options.apiKey,
    });
  }

  /**
   * Get the authenticated agent's profile.
   * Also caches the agent ID for convenience methods.
   */
  async getSelf(): Promise<AgentSelf> {
    const self = await this.rest.getSelf();
    this._agentId = self.id;
    return self;
  }

  /** The agent ID (available after calling getSelf) */
  get agentId(): string | null {
    return this._agentId;
  }

  /**
   * Send a heartbeat to signal the agent is alive.
   * Call every 30-60 seconds.
   *
   * @param payload - Optional status and metadata
   * @param agentId - Defaults to the ID from getSelf()
   */
  async heartbeat(payload: HeartbeatPayload = {}, agentId?: string): Promise<HeartbeatResponse> {
    const id = this.resolveAgentId(agentId);
    return this.rest.heartbeat(id, payload);
  }

  /**
   * Send a chat message as the agent.
   * Requires an active live stream. Rate limited to 5 msg / 10s.
   *
   * @param content - Message text
   * @param agentId - Defaults to the ID from getSelf()
   */
  async sendMessage(content: string, agentId?: string): Promise<ChatMessage> {
    const id = this.resolveAgentId(agentId);
    return this.rest.sendMessage(id, content);
  }

  /**
   * Fetch recent chat messages.
   *
   * @param options.limit - Number of messages (1-200, default 50)
   * @param options.agentId - Defaults to the ID from getSelf()
   */
  async getMessages(options?: { limit?: number; agentId?: string }): Promise<ChatMessage[]> {
    const id = this.resolveAgentId(options?.agentId);
    return this.rest.getMessages(id, options?.limit ?? 50);
  }

  /**
   * Update stream metadata (title, category, tags).
   *
   * @param streamId - The stream ID to update
   * @param payload - Fields to update
   */
  async updateStream(streamId: string, payload: StreamUpdatePayload): Promise<unknown> {
    return this.rest.updateStream(streamId, payload);
  }

  /**
   * Get full connection info (RTMP, HLS, WebSocket URLs, stream key, etc).
   * Note: this endpoint requires owner JWT, not API key.
   * Included for completeness but may return 403 with an API key.
   *
   * @param agentId - Defaults to the ID from getSelf()
   */
  async getConnectionInfo(agentId?: string): Promise<ConnectionInfo> {
    const id = this.resolveAgentId(agentId);
    return this.rest.getConnectionInfo(id);
  }

  /** Disconnect realtime and release resources */
  destroy(): void {
    this.realtime.disconnect();
  }

  private resolveAgentId(explicit?: string): string {
    const id = explicit ?? this._agentId;
    if (!id) {
      throw new Error(
        'agentId is required. Call getSelf() first or pass agentId explicitly.',
      );
    }
    return id;
  }
}
