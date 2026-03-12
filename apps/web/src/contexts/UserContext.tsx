'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

const STORAGE_KEY = 'liveclaw_user';

interface UserData {
  id: string;
  username: string;
  token: string;
  role: string;
}

interface UserContextValue {
  user: UserData | null;
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  becomeCreator: () => Promise<void>;
  showLoginModal: boolean;
  setShowLoginModal: (show: boolean) => void;
  isAdmin: boolean;
  isCreator: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.token) {
          setUser(parsed);
        } else {
          // Legacy user without token — clear it
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoaded(true);
  }, []);

  const saveUser = useCallback((data: UserData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setUser(data);
    setShowLoginModal(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await api<{ access_token: string; user: { id: string; username: string; role: string } }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        },
      );
      saveUser({ id: res.user.id, username: res.user.username, token: res.access_token, role: res.user.role });
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
      throw err;
    }
  }, [saveUser]);

  const register = useCallback(async (username: string, password: string) => {
    try {
      const res = await api<{ access_token: string; user: { id: string; username: string; role: string } }>(
        '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        },
      );
      saveUser({ id: res.user.id, username: res.user.username, token: res.access_token, role: res.user.role });
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
      throw err;
    }
  }, [saveUser]);

  const becomeCreator = useCallback(async () => {
    try {
      const res = await api<{ access_token: string; user: { id: string; username: string; role: string } }>(
        '/auth/become-creator',
        { method: 'POST' },
      );
      saveUser({ id: res.user.id, username: res.user.username, token: res.access_token, role: res.user.role });
      toast.success('You are now a creator! You can create agents.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upgrade to creator');
      throw err;
    }
  }, [saveUser]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  if (!loaded) return null;

  const isAdmin = user?.role === 'admin';
  const isCreator = user?.role === 'creator' || isAdmin;

  return (
    <UserContext.Provider
      value={{ user, isLoggedIn: !!user, login, register, logout, becomeCreator, showLoginModal, setShowLoginModal, isAdmin, isCreator }}
    >
      {children}
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}

function LoginModal({ onClose }: { onClose: () => void }) {
  const { login, register } = useUser();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed || !password) return;

    if (mode === 'register') {
      if (trimmed.length < 3 || trimmed.length > 20) {
        setError('Username must be 3-20 characters');
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        setError('Only letters, numbers, and underscores');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }

    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        await login(trimmed, password);
      } else {
        await register(trimmed, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-claw-surface border border-claw-border rounded-lg p-6 w-[360px]">
        <div className="flex flex-col items-center mb-4">
          <img src="/logo.png" alt="LiveClaw" className="w-14 h-14 mb-3" />
          <h2 className="text-lg font-bold">
            {mode === 'login' ? 'Log In to LiveClaw' : 'Join LiveClaw'}
          </h2>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text placeholder:text-claw-text-muted focus:outline-none focus:border-claw-accent mb-2"
            autoFocus
            maxLength={20}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text placeholder:text-claw-text-muted focus:outline-none focus:border-claw-accent mb-2"
          />
          {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm border border-claw-border rounded hover:bg-claw-card transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="flex-1 px-4 py-2 bg-claw-accent text-white text-sm font-semibold rounded hover:bg-claw-accent-hover disabled:opacity-50 transition-colors"
            >
              {loading ? '...' : mode === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            className="w-full text-center text-xs text-claw-text-muted hover:text-claw-accent mt-3"
          >
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}
