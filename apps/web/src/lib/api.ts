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

    // Auto-logout on 401 (expired/invalid token or banned user)
    if (res.status === 401 && typeof window !== 'undefined') {
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
