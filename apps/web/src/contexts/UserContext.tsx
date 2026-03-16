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
    } catch (err: any) {
      toast.error(err.message || 'Wallet login failed');
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
      value={{ user, isLoggedIn: !!user, loginWithWallet, logout, becomeCreator, updateUser, showLoginModal, setShowLoginModal, isAdmin, isCreator }}
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
  const { loginWithWallet } = useUser();
  const [activeWallet, setActiveWallet] = useState<WalletProvider | null>(null);
  const [loading, setLoading] = useState(false);

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

  const hasEthereum = typeof window !== 'undefined' && !!(window as any).ethereum;
  const hasPhantom = typeof window !== 'undefined' && !!(window as any).phantom?.ethereum;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-claw-surface border border-claw-border rounded-lg p-6 w-[360px]">
        <div className="flex flex-col items-center mb-5">
          <img src="/logo.png" alt="LiveClaw" className="w-14 h-14 mb-3" />
          <h2 className="text-lg font-bold">Connect Wallet</h2>
          <p className="text-xs text-claw-text-muted mt-1 text-center">
            Connect your Ethereum wallet to sign in or create an account.
          </p>
        </div>

        {!hasEthereum && !hasPhantom ? (
          <div className="text-center py-4">
            <p className="text-sm text-claw-text-muted mb-3">
              No wallet detected. Please install a wallet extension to continue.
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
                <path d="M28.2295 23.5334L24.7346 28.872L32.2271 30.932L34.3803 23.6526L28.2295 23.5334Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1.27271 23.6526L3.39385 30.932L10.8864 28.872L7.39148 23.5334L1.27271 23.6526Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10.4706 14.5149L8.39185 17.4768L15.7788 17.8114L15.543 9.86279L10.4706 14.5149Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M25.1505 14.5149L19.9995 9.77246L19.8241 17.8114L27.2293 17.4768L25.1505 14.5149Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10.8864 28.8721L15.3574 26.7106L11.4776 23.6982L10.8864 28.8721Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20.2637 26.7106L24.7346 28.8721L24.1435 23.6982L20.2637 26.7106Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
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
