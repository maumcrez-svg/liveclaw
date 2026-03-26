// ── OBS WebSocket connection wrapper ────────────────────────────────
//
// Wraps obs-websocket-js v5 with auto-reconnect (exponential backoff)
// and typed event callbacks.

import OBSWebSocket from 'obs-websocket-js';
import type { OBSConnectionState } from './types';

const OBS_WS_URL = 'ws://127.0.0.1:4455';
const MAX_BACKOFF_MS = 16_000;
const BASE_BACKOFF_MS = 1_000;
const MAX_RECONNECT_ATTEMPTS = 20;

export class OBSConnection {
  private obs: OBSWebSocket;
  private _connected = false;
  private _state: OBSConnectionState = 'disconnected';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private shouldReconnect = false;
  private lastPassword: string | undefined;

  // ── public callbacks ────────────────────────────────────────────
  onConnected: (() => void) | null = null;
  onDisconnected: ((reason?: string) => void) | null = null;
  onStreamStateChanged: ((active: boolean) => void) | null = null;
  onStateChanged: ((state: OBSConnectionState) => void) | null = null;
  onReconnecting: ((attempt: number) => void) | null = null;
  onReconnectFailed: (() => void) | null = null;

  constructor() {
    this.obs = new OBSWebSocket();

    this.obs.on('ConnectionClosed', () => {
      this._connected = false;
      this.setState('disconnected');
      this.onDisconnected?.();
      this.scheduleReconnect();
    });

    this.obs.on('StreamStateChanged', (data: any) => {
      const active = data.outputState === 'OBS_WEBSOCKET_OUTPUT_STARTED' ||
                     data.outputState === 'OBS_WEBSOCKET_OUTPUT_RESUMED';
      this.onStreamStateChanged?.(active);
    });
  }

  get state(): OBSConnectionState {
    return this._state;
  }

  private setState(s: OBSConnectionState) {
    this._state = s;
    this.onStateChanged?.(s);
  }

  // ── connect ─────────────────────────────────────────────────────

  async connect(password?: string): Promise<void> {
    this.shouldReconnect = true;
    this.lastPassword = password;
    this.clearReconnect();
    this.setState('connecting');

    try {
      await this.obs.connect(OBS_WS_URL, password || undefined);
      this._connected = true;
      this.reconnectAttempt = 0;
      this.setState('connected');
      this.onConnected?.();
    } catch (err: any) {
      this._connected = false;

      // obs-websocket error code 4009 = authentication required
      if (err?.code === 4009 || err?.message?.includes('Authentication')) {
        this.setState('auth_required');
        // Don't auto-reconnect for auth errors — user must provide password
        this.shouldReconnect = false;
        return;
      }

      this.setState('error');
      this.scheduleReconnect();
      throw err;
    }
  }

  // ── disconnect ──────────────────────────────────────────────────

  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    this.clearReconnect();
    if (this._connected) {
      await this.obs.disconnect();
    }
    this._connected = false;
    this.setState('disconnected');
  }

  // ── status ──────────────────────────────────────────────────────

  isConnected(): boolean {
    return this._connected;
  }

  // ── passthrough call ────────────────────────────────────────────

  async call<T = any>(requestType: string, requestData?: Record<string, any>): Promise<T> {
    if (!this._connected) {
      throw new Error('OBS is not connected');
    }
    return this.obs.call(requestType as any, requestData as any) as Promise<T>;
  }

  // ── auto-reconnect ─────────────────────────────────────────────

  private scheduleReconnect() {
    if (!this.shouldReconnect) return;

    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      this.shouldReconnect = false;
      this.setState('error');
      this.onReconnectFailed?.();
      return;
    }

    this.clearReconnect();

    const delay = Math.min(
      BASE_BACKOFF_MS * Math.pow(2, this.reconnectAttempt),
      MAX_BACKOFF_MS,
    );
    this.reconnectAttempt++;
    this.onReconnecting?.(this.reconnectAttempt);

    this.reconnectTimer = setTimeout(async () => {
      if (!this.shouldReconnect) return;
      try {
        await this.connect(this.lastPassword);
      } catch {
        // connect() will reschedule if needed
      }
    }, delay);
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// ── singleton ──────────────────────────────────────────────────────

let _instance: OBSConnection | null = null;

export function getOBS(): OBSConnection {
  if (!_instance) {
    _instance = new OBSConnection();
  }
  return _instance;
}
