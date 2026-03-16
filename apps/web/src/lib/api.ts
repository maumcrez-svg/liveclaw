const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('liveclaw_user');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed.token || null;
  } catch {
    return null;
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const stored = localStorage.getItem('liveclaw_user');
      if (!stored) return false;
      const parsed = JSON.parse(stored);
      if (!parsed.refresh_token) return false;

      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: parsed.refresh_token }),
      });
      if (!res.ok) return false;

      const data = await res.json();
      const updated = {
        ...parsed,
        token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user,
      };
      localStorage.setItem('liveclaw_user', JSON.stringify(updated));
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));

    // Attempt silent refresh on 401, then retry once
    if (res.status === 401 && typeof window !== 'undefined') {
      const refreshed = await attemptRefresh();
      if (refreshed) {
        const newToken = getToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
        }
        const retryRes = await fetch(`${API_URL}${path}`, { ...options, headers });
        if (retryRes.ok) {
          if (retryRes.status === 204) return undefined as T;
          return retryRes.json();
        }
      }
      localStorage.removeItem('liveclaw_user');
      window.dispatchEvent(new Event('liveclaw:logout'));
    }

    const rawMsg = Array.isArray(body.message) ? body.message.join('. ') : body.message;
    const err = new Error(rawMsg || `API error ${res.status}`) as any;
    err.status = res.status;
    err.body = body;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}
