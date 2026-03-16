import { io, type Socket } from 'socket.io-client';
import type { NewMessageEvent, ViewerCountEvent, RateLimitedEvent } from './types';

export interface RealtimeOptions {
  url: string;
  apiKey: string;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
}

export class RealtimeClient {
  private socket: Socket | null = null;
  private readonly options: Required<RealtimeOptions>;
  private _connected = false;

  constructor(options: RealtimeOptions) {
    this.options = {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      ...options,
    };
  }

  /** Whether the socket is currently connected */
  get connected(): boolean {
    return this._connected;
  }

  /** Connect to the WebSocket server */
  connect(): void {
    if (this.socket) return;

    this.socket = io(this.options.url, {
      auth: { token: this.options.apiKey },
      reconnection: this.options.reconnection,
      reconnectionAttempts: this.options.reconnectionAttempts,
      reconnectionDelay: this.options.reconnectionDelay,
      reconnectionDelayMax: this.options.reconnectionDelayMax,
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      this._connected = true;
    });

    this.socket.on('disconnect', () => {
      this._connected = false;
    });
  }

  /** Disconnect and clean up */
  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this._connected = false;
    }
  }

  /** Join a stream room to receive events */
  joinStream(streamId: string): void {
    this.ensureSocket();
    this.socket!.emit('join_stream', { streamId });
  }

  /** Leave a stream room */
  leaveStream(streamId: string): void {
    this.ensureSocket();
    this.socket!.emit('leave_stream', { streamId });
  }

  /** Send a chat message via WebSocket */
  sendMessage(streamId: string, content: string): void {
    this.ensureSocket();
    this.socket!.emit('send_message', { streamId, content });
  }

  /** Listen for new chat messages. Returns an unsubscribe function. */
  onMessage(handler: (message: NewMessageEvent) => void): () => void {
    return this.on('new_message', handler);
  }

  /** Listen for viewer count updates. Returns an unsubscribe function. */
  onViewerCount(handler: (data: ViewerCountEvent) => void): () => void {
    return this.on('viewer_count', handler);
  }

  /** Listen for rate limit warnings. Returns an unsubscribe function. */
  onRateLimited(handler: (data: RateLimitedEvent) => void): () => void {
    return this.on('rate_limited', handler);
  }

  /** Listen for connection. Returns an unsubscribe function. */
  onConnect(handler: () => void): () => void {
    return this.on('connect', handler);
  }

  /** Listen for disconnection. Returns an unsubscribe function. */
  onDisconnect(handler: (reason: string) => void): () => void {
    return this.on('disconnect', handler);
  }

  /** Listen for connection errors. Returns an unsubscribe function. */
  onError(handler: (error: Error) => void): () => void {
    return this.on('connect_error', handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private on(event: string, handler: (...args: any[]) => void): () => void {
    if (!this.socket) {
      this.connect();
    }
    this.socket!.on(event, handler);
    return () => {
      this.socket?.off(event, handler);
    };
  }

  private ensureSocket(): void {
    if (!this.socket) {
      throw new Error('Realtime client is not connected. Call connect() first.');
    }
  }
}
