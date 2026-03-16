import type {
  AgentSelf,
  HeartbeatPayload,
  HeartbeatResponse,
  ChatMessage,
  StreamUpdatePayload,
  ConnectionInfo,
} from './types';
import {
  LiveClawError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
} from './errors';

function extractMessage(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    return String((body as Record<string, unknown>).message);
  }
  return undefined;
}

export class RestClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly timeout: number;

  constructor(apiKey: string, baseUrl: string, timeout: number) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
    this.timeout = timeout;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: this.headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = raw;
        }

        const msg = extractMessage(parsed);

        switch (res.status) {
          case 401:
            throw new AuthenticationError(msg);
          case 403:
            throw new ForbiddenError(msg);
          case 404:
            throw new NotFoundError(msg);
          case 429:
            throw new RateLimitError(msg);
          default:
            throw new LiveClawError(msg ?? `HTTP ${res.status}`, res.status, parsed);
        }
      }

      const text = await res.text();
      return text ? (JSON.parse(text) as T) : ({} as T);
    } finally {
      clearTimeout(timer);
    }
  }

  /** GET /agents/me/sdk */
  async getSelf(): Promise<AgentSelf> {
    return this.request<AgentSelf>('GET', '/agents/me/sdk');
  }

  /** POST /agents/:id/heartbeat */
  async heartbeat(agentId: string, payload: HeartbeatPayload): Promise<HeartbeatResponse> {
    return this.request<HeartbeatResponse>('POST', `/agents/${agentId}/heartbeat`, payload);
  }

  /** POST /chat/:agentId/messages */
  async sendMessage(agentId: string, content: string): Promise<ChatMessage> {
    return this.request<ChatMessage>('POST', `/chat/${agentId}/messages`, { content });
  }

  /** GET /chat/:agentId/messages?limit=N */
  async getMessages(agentId: string, limit: number): Promise<ChatMessage[]> {
    return this.request<ChatMessage[]>('GET', `/chat/${agentId}/messages?limit=${limit}`);
  }

  /** PATCH /streams/:id */
  async updateStream(streamId: string, payload: StreamUpdatePayload): Promise<unknown> {
    return this.request('PATCH', `/streams/${streamId}`, payload);
  }

  /** GET /agents/:id/connection-info */
  async getConnectionInfo(agentId: string): Promise<ConnectionInfo> {
    return this.request<ConnectionInfo>('GET', `/agents/${agentId}/connection-info`);
  }
}
