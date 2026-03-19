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
  refresh_token: string;
  user: AuthResponseUser;
}

interface UserData {
  id: string;
  username: string;
  token: string;
  refresh_token: string;
  role: string;
  avatarUrl?: string | null;
  walletAddress?: string | null;
}

type WalletProvider = 'metamask' | 'phantom';

interface UserContextValue {
  user: UserData | null;
  isLoggedIn: boolean;
  loginWithWallet: (provider: WalletProvider) => Promise<void>;
  loginWithCredentials: (username: string, password: string, isRegister: boolean) => Promise<void>;
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
    refresh_token: res.refresh_token,
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

  const loginWithWallet = useCallback(async (provider: WalletProvider) => {
    // Resolve the EIP-1193 provider
    const w = window as any;
    let ethereum: any;

    if (provider === 'phantom') {
      ethereum = w.phantom?.ethereum;
      if (!ethereum) {
        toast.error('Phantom wallet not found. Install it at phantom.app');
        return;
      }
    } else {
      // MetaMask -- prefer MetaMask's own provider over injected generic
      ethereum = w.ethereum?.isMetaMask ? w.ethereum : w.ethereum;
      if (!ethereum) {
        toast.error('MetaMask not found. Install it at metamask.io');
        return;
      }
    }

    const providerName = provider === 'phantom' ? 'Phantom' : 'MetaMask';

    try {
      // 1. Request accounts
      let accounts: string[];
      try {
        accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      } catch (e: any) {
        if (e.code === 4001) {
          toast.error('Connection rejected');
          return;
        }
        toast.error(`${providerName}: could not connect -- ${e.message || 'unknown error'}`);
        return;
      }

      if (!accounts || accounts.length === 0) {
        toast.error(`${providerName}: no accounts available`);
        return;
      }
      const address = accounts[0];

      // 2. Get nonce from backend
      let nonceData: { nonce: string; message: string };
      try {
        nonceData = await api<{ nonce: string; message: string }>('/auth/wallet-nonce');
      } catch (e: any) {
        const isNetwork = e.message?.includes('NetworkError') || e.message?.includes('Failed to fetch');
        toast.error(isNetwork
          ? 'Cannot reach server. Check your connection and try again.'
          : `Server error: ${e.message || 'failed to get nonce'}`);
        return;
      }

      // 3. Sign message
      let signature: string;
      try {
        signature = await ethereum.request({
          method: 'personal_sign',
          params: [nonceData.message, address],
        });
      } catch (e: any) {
        if (e.code === 4001) {
          toast.error('Signature rejected');
          return;
        }
        toast.error(`${providerName}: signing failed -- ${e.message || 'unknown error'}`);
        return;
      }

      // 4. Authenticate with backend
      let res: AuthApiResponse;
      try {
        res = await api<AuthApiResponse>('/auth/wallet-login', {
          method: 'POST',
          body: JSON.stringify({ address, message: nonceData.message, signature }),
        });
      } catch (e: any) {
        const isNetwork = e.message?.includes('NetworkError') || e.message?.includes('Failed to fetch');
        if (isNetwork) {
          toast.error('Cannot reach server. Check your connection and try again.');
        } else if (e.status === 401) {
          toast.error('Signature verification failed. Try again.');
        } else if (e.status === 400) {
          toast.error(e.message || 'Invalid request. Nonce may have expired -- try again.');
        } else {
          toast.error(e.message || 'Login failed');
        }
        return;
      }

      saveUser(authResponseToUserData(res));
      toast.success('Wallet connected!');

      // Check for post-login redirect
      if (typeof window !== 'undefined') {
        const redirect = sessionStorage.getItem('liveclaw_redirect');
        if (redirect) {
          sessionStorage.removeItem('liveclaw_redirect');
          window.location.href = redirect;
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Wallet login failed');
    }
  }, [saveUser]);

  const loginWithCredentials = useCallback(async (username: string, password: string, isRegister: boolean) => {
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const res = await api<AuthApiResponse>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      saveUser(authResponseToUserData(res));
      toast.success(isRegister ? 'Account created!' : 'Logged in!');

      // Check for post-login redirect
      if (typeof window !== 'undefined') {
        const redirect = sessionStorage.getItem('liveclaw_redirect');
        if (redirect) {
          sessionStorage.removeItem('liveclaw_redirect');
          window.location.href = redirect;
        }
      }
    } catch (err: any) {
      if (err.status === 409) {
        toast.error('Username already taken');
      } else if (err.status === 401) {
        toast.error('Invalid username or password');
      } else {
        toast.error(err.message || 'Authentication failed');
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
      toast.error('Session expired. Please connect your wallet again.');
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
      value={{ user, isLoggedIn: !!user, loginWithWallet, loginWithCredentials, logout, becomeCreator, updateUser, showLoginModal, setShowLoginModal, isAdmin, isCreator }}
    >
      {children}
      {showLoginModal && <WalletConnectModal onClose={() => setShowLoginModal(false)} />}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Wallet-only login modal                                           */
/* ------------------------------------------------------------------ */

function WalletConnectModal({ onClose }: { onClose: () => void }) {
  const { loginWithWallet, loginWithCredentials } = useUser();
  const [activeWallet, setActiveWallet] = useState<WalletProvider | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'credentials' | 'wallet'>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);

  const handleConnect = async (provider: WalletProvider) => {
    setActiveWallet(provider);
    setLoading(true);
    try {
      await loginWithWallet(provider);
    } catch {
      // Error already toasted in loginWithWallet
    } finally {
      setLoading(false);
      setActiveWallet(null);
    }
  };

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    try {
      await loginWithCredentials(username.trim(), password, isRegister);
    } catch {
      // Error already toasted
    } finally {
      setLoading(false);
    }
  };

  const hasEthereum = typeof window !== 'undefined' && !!(window as any).ethereum;
  const hasPhantom = typeof window !== 'undefined' && !!(window as any).phantom?.ethereum;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-claw-surface border border-claw-border rounded-lg p-6 w-[360px]">
        <div className="flex flex-col items-center mb-5">
          <img src="/logo.png" alt="LiveClaw" className="w-14 h-14 mb-3" />
          <h2 className="text-lg font-bold">{isRegister ? 'Create Account' : 'Sign In'}</h2>
          <p className="text-xs text-claw-text-muted mt-1 text-center">
            {tab === 'credentials' ? 'Sign in with username and password.' : 'Connect your Ethereum wallet.'}
          </p>
        </div>

        {/* Tab toggle */}
        <div className="flex mb-4 bg-claw-bg rounded-lg p-0.5 border border-claw-border">
          <button
            type="button"
            onClick={() => setTab('credentials')}
            className={`flex-1 text-xs font-semibold py-2 rounded-md transition-colors ${
              tab === 'credentials' ? 'bg-claw-card text-claw-text shadow-sm' : 'text-claw-text-muted hover:text-claw-text'
            }`}
          >
            Username
          </button>
          <button
            type="button"
            onClick={() => setTab('wallet')}
            className={`flex-1 text-xs font-semibold py-2 rounded-md transition-colors ${
              tab === 'wallet' ? 'bg-claw-card text-claw-text shadow-sm' : 'text-claw-text-muted hover:text-claw-text'
            }`}
          >
            Connect Wallet
          </button>
        </div>

        {tab === 'credentials' ? (
          <form onSubmit={handleCredentials} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-claw-text-muted">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2.5 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
                placeholder="Enter username"
                autoComplete="username"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-claw-text-muted">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2.5 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
                placeholder="Enter password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !username.trim() || !password.trim()}
              className="w-full px-4 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {loading ? (isRegister ? 'Creating...' : 'Signing in...') : (isRegister ? 'Create Account' : 'Sign In')}
            </button>
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-xs text-claw-text-muted hover:text-claw-accent transition-colors text-center"
            >
              {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
            </button>
          </form>
        ) : (
          <>
            {!hasEthereum && !hasPhantom ? (
              <div className="text-center py-4">
                <p className="text-sm text-claw-text-muted mb-3">
                  No wallet detected. Install a wallet extension or use username/password.
                </p>
                <a
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-[#f6851b] text-white text-sm font-semibold rounded hover:bg-[#e2761b] transition-colors"
                >
                  Install MetaMask
                </a>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleConnect('metamask')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#f6851b] text-white text-sm font-semibold rounded hover:bg-[#e2761b] disabled:opacity-50 transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 35 33" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M32.9582 1L19.8241 10.7183L22.2665 4.99099L32.9582 1Z" fill="#E17726" stroke="#E17726" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2.66296 1L15.6886 10.809L13.3546 4.99099L2.66296 1Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {loading && activeWallet === 'metamask' ? 'Connecting...' : 'MetaMask'}
                </button>
                <button
                  type="button"
                  onClick={() => handleConnect('phantom')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#ab9ff2] text-white text-sm font-semibold rounded hover:bg-[#9580e6] disabled:opacity-50 transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="64" cy="64" r="64" fill="transparent"/>
                    <path d="M110.6 55.1C109.1 43.7 104.7 33.5 97.4 25.5C89.3 16.7 78.2 11.1 66 10C65.3 9.9 64.7 9.9 64 9.9C51 9.9 38.9 15.1 30 24.4C21.7 33.1 17 44.3 16.5 56.3C16 68.4 20.3 79.9 28.5 88.9C37 98.2 48.7 103.8 61.3 104.3C61.8 104.3 62.3 104.3 62.8 104.3C67.5 104.3 72.2 103.4 76.6 101.5C77.6 101.1 78.2 100.1 78.1 99C78 97.9 77.3 97 76.3 96.7C71.8 95.3 68.8 91.2 68.8 86.5C68.8 80.3 73.8 75.3 80 75.3C80.8 75.3 81.6 75.4 82.4 75.5C82.5 75.5 82.6 75.6 82.7 75.6C95.7 78.5 105 87.3 107.7 86C110.8 84.5 112.3 68.3 110.6 55.1ZM42.4 68.8C38.2 68.8 34.7 65.3 34.7 61.1C34.7 56.9 38.2 53.4 42.4 53.4C46.6 53.4 50.1 56.9 50.1 61.1C50.1 65.4 46.6 68.8 42.4 68.8ZM69.6 57.5C65.4 57.5 61.9 54 61.9 49.8C61.9 45.6 65.4 42.1 69.6 42.1C73.8 42.1 77.3 45.6 77.3 49.8C77.3 54 73.8 57.5 69.6 57.5Z" fill="white"/>
                  </svg>
                  {loading && activeWallet === 'phantom' ? 'Connecting...' : 'Phantom'}
                </button>
              </div>
            )}
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-4 px-4 py-2 text-sm border border-claw-border rounded hover:bg-claw-card transition-colors text-center"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
