'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

const STORAGE_KEY = 'liveclaw_user';

interface AuthResponseUser {
  id: string;
  username: string;
  role: string;
  avatarUrl: string | null;
  walletAddress: string | null;
}

interface AuthApiResponse {
  access_token: string;
  user: AuthResponseUser;
}

interface UserData {
  id: string;
  username: string;
  token: string;
  role: string;
  avatarUrl?: string | null;
  walletAddress?: string | null;
}

interface UserContextValue {
  user: UserData | null;
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  loginWithWallet: () => Promise<void>;
  logout: () => void;
  becomeCreator: () => Promise<void>;
  updateUser: (data: Partial<UserData>) => void;
  showLoginModal: boolean;
  setShowLoginModal: (show: boolean) => void;
  isAdmin: boolean;
  isCreator: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

function authResponseToUserData(res: AuthApiResponse): UserData {
  return {
    id: res.user.id,
    username: res.user.username,
    token: res.access_token,
    role: res.user.role,
    avatarUrl: res.user.avatarUrl,
    walletAddress: res.user.walletAddress,
  };
}

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

  const updateUser = useCallback((data: Partial<UserData>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await api<AuthApiResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      saveUser(authResponseToUserData(res));
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
      throw err;
    }
  }, [saveUser]);

  const register = useCallback(async (username: string, password: string) => {
    try {
      const res = await api<AuthApiResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      saveUser(authResponseToUserData(res));
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
      throw err;
    }
  }, [saveUser]);

  const loginWithWallet = useCallback(async () => {
    try {
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        toast.error('MetaMask is not installed. Please install MetaMask to connect your wallet.');
        return;
      }

      const ethereum = (window as any).ethereum;

      // Request accounts
      const accounts: string[] = await ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        toast.error('No accounts found. Please connect MetaMask.');
        return;
      }
      const address = accounts[0];

      // Get nonce from backend
      const { message } = await api<{ nonce: string; message: string }>('/auth/wallet-nonce');

      // Sign message
      const signature: string = await ethereum.request({
        method: 'personal_sign',
        params: [message, address],
      });

      // Authenticate
      const res = await api<AuthApiResponse>('/auth/wallet-login', {
        method: 'POST',
        body: JSON.stringify({ address, message, signature }),
      });
      saveUser(authResponseToUserData(res));
      toast.success('Wallet connected successfully!');
    } catch (err: any) {
      if (err.code === 4001) {
        toast.error('Signature request was rejected');
      } else {
        toast.error(err.message || 'Wallet login failed');
      }
      throw err;
    }
  }, [saveUser]);

  const becomeCreator = useCallback(async () => {
    try {
      const res = await api<AuthApiResponse>('/auth/become-creator', { method: 'POST' });
      saveUser(authResponseToUserData(res));
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

  // Listen for forced logout from api.ts on 401
  useEffect(() => {
    const handleForcedLogout = () => {
      setUser(null);
      setShowLoginModal(true);
      toast.error('Session expired. Please log in again.');
    };
    window.addEventListener('liveclaw:logout', handleForcedLogout);
    return () => window.removeEventListener('liveclaw:logout', handleForcedLogout);
  }, []);

  if (!loaded) {
    return (
      <div className="h-screen w-screen bg-claw-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-claw-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-claw-text-muted">Loading...</span>
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';
  const isCreator = user?.role === 'creator' || isAdmin;

  return (
    <UserContext.Provider
      value={{ user, isLoggedIn: !!user, login, register, loginWithWallet, logout, becomeCreator, updateUser, showLoginModal, setShowLoginModal, isAdmin, isCreator }}
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
  const { login, register, loginWithWallet } = useUser();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);

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

  const handleWalletLogin = async () => {
    setWalletLoading(true);
    setError('');
    try {
      await loginWithWallet();
    } catch (err: any) {
      if (err.code !== 4001) {
        setError(err.message || 'Wallet login failed');
      }
    } finally {
      setWalletLoading(false);
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

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-claw-border" />
          <span className="text-xs text-claw-text-muted">or</span>
          <div className="flex-1 h-px bg-claw-border" />
        </div>

        {/* MetaMask login */}
        <button
          type="button"
          onClick={handleWalletLogin}
          disabled={walletLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#f6851b] text-white text-sm font-semibold rounded hover:bg-[#e2761b] disabled:opacity-50 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 35 33" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M32.9582 1L19.8241 10.7183L22.2665 4.99099L32.9582 1Z" fill="#E17726" stroke="#E17726" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2.66296 1L15.6886 10.809L13.3546 4.99099L2.66296 1Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M28.2295 23.5334L24.7346 28.872L32.2271 30.932L34.3803 23.6526L28.2295 23.5334Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1.27271 23.6526L3.39385 30.932L10.8864 28.872L7.39148 23.5334L1.27271 23.6526Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10.4706 14.5149L8.39185 17.4768L15.7788 17.8114L15.543 9.86279L10.4706 14.5149Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M25.1505 14.5149L19.9995 9.77246L19.8241 17.8114L27.2293 17.4768L25.1505 14.5149Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10.8864 28.8721L15.3574 26.7106L11.4776 23.6982L10.8864 28.8721Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20.2637 26.7106L24.7346 28.8721L24.1435 23.6982L20.2637 26.7106Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {walletLoading ? 'Connecting...' : 'Connect with MetaMask'}
        </button>
      </div>
    </div>
  );
}
