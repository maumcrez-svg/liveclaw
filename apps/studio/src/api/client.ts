// ── LiveClaw API client ─────────────────────────────────────────────
//
// Handles Bearer JWT auth, automatic token refresh on 401, and
// transitions back to login on refresh failure.

import type { AuthResponse, Agent, ConnectionInfo } from './types';
import { useAuthStore } from '../store/auth-store';

const API_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  '';
if (!API_URL) console.error('[API] VITE_API_URL is not set! API calls will fail.');

const REQUEST_TIMEOUT_MS = 15_000;

function fetchWithTimeout(url: string, opts: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ── internal helpers ────────────────────────────────────────────────

let refreshPromise: Promise<AuthResponse> | null = null;

async function request<T>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> ?? {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const res = await fetchWithTimeout(`${API_URL}${path}`, { ...opts, headers });

    if (res.status === 401 && accessToken) {
      // Attempt a single refresh, then retry the original request once
      const refreshed = await attemptRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${refreshed.access_token}`;
        const retry = await fetchWithTimeout(`${API_URL}${path}`, { ...opts, headers });
        if (!retry.ok) {
          throw new ApiError(retry.status, await safeText(retry));
        }
        return retry.json() as Promise<T>;
      }
      // Refresh failed - clear auth, caller should transition to login
      console.warn('[Auth] Token refresh failed — clearing session');
      await useAuthStore.getState().clearAuth();
      throw new ApiError(401, 'Session expired');
    }

    if (!res.ok) {
      throw new ApiError(res.status, await safeText(res));
    }

    // Some endpoints return 204 with no body
    if (res.status === 204) return undefined as unknown as T;
    return res.json() as Promise<T>;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new ApiError(0, 'Request timed out. Check your connection.');
    }
    throw err;
  }
}

async function attemptRefresh(): Promise<AuthResponse | null> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) return null;

  // Deduplicate concurrent refresh calls
  if (!refreshPromise) {
    refreshPromise = doRefresh(refreshToken);
    refreshPromise.finally(() => { refreshPromise = null; });
  }

  try {
    return await refreshPromise;
  } catch {
    return null;
  }
}

async function doRefresh(refreshToken: string): Promise<AuthResponse> {
  console.log('[Auth] Refreshing token...');
  const res = await fetchWithTimeout(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    throw new Error('Refresh failed');
  }

  const data: AuthResponse = await res.json();
  await useAuthStore.getState().setAuth(data);
  console.log('[Auth] Token refreshed successfully');
  return data;
}

async function safeText(res: Response): Promise<string> {
  try {
    const json = await res.json();
    return json.message || json.error || JSON.stringify(json);
  } catch {
    return res.statusText || 'Unknown error';
  }
}

// ── public error class ──────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── public API functions ────────────────────────────────────────────

export async function login(
  username: string,
  password: string,
): Promise<AuthResponse> {
  const data = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  await useAuthStore.getState().setAuth(data);
  return data;
}

export async function register(
  username: string,
  password: string,
): Promise<AuthResponse> {
  const data = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  await useAuthStore.getState().setAuth(data);
  return data;
}

export async function refreshTokens(): Promise<AuthResponse | null> {
  return attemptRefresh();
}

export async function fetchAgents(): Promise<Agent[]> {
  return request<Agent[]>('/agents/mine');
}

export async function fetchConnectionInfo(
  agentId: string,
): Promise<ConnectionInfo> {
  return request<ConnectionInfo>(`/agents/${agentId}/connection-info`);
}

export async function becomeCreator(): Promise<void> {
  await request('/auth/become-creator', { method: 'POST' });
}

export async function createAgent(data: {
  name: string;
  slug: string;
  description: string;
  agentType?: string;
  streamingMode?: 'native' | 'external';
  instructions?: string;
  defaultTags?: string[];
  apiKey?: string;
  model?: string;
  config?: Record<string, unknown>;
}): Promise<Agent> {
  return request<Agent>('/agents', {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      config: data.config || {},
      agentType: data.agentType || 'custom',
      streamingMode: data.streamingMode || 'external',
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(data.slug)}`,
    }),
  });
}

export async function fetchAgentBySlug(
  slug: string,
): Promise<Agent> {
  return request<Agent>(`/agents/${slug}/private`);
}

export async function fetchViewerCount(agentId: string): Promise<number> {
  try {
    const data = await request<{ viewers: number }>(`/streams/agent/${agentId}/viewers`);
    return data.viewers ?? 0;
  } catch {
    return 0;
  }
}

export async function updateStreamTitle(streamId: string, title: string): Promise<void> {
  await request(`/streams/${streamId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
}

export async function fetchActiveStreamId(agentId: string): Promise<string | null> {
  try {
    // Try the stream history endpoint — returns most recent stream
    const data = await request<Array<{ id: string; isLive: boolean }>>(`/streams/agent/${agentId}`);
    if (Array.isArray(data) && data.length > 0) {
      // Prefer live stream, fallback to most recent
      const live = data.find((s) => s.isLive);
      return live?.id ?? data[0].id ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Exchange a one-time studio token (from deep link) for a full auth session. */
export async function exchangeStudioToken(token: string): Promise<AuthResponse> {
  const res = await fetchWithTimeout(`${API_URL}/auth/exchange-studio-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, await safeText(res));
  }
  const data: AuthResponse = await res.json();
  await useAuthStore.getState().setAuth(data);
  return data;
}
