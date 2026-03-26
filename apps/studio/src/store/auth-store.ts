// ── Auth store ──────────────────────────────────────────────────────
//
// Holds JWT tokens and user info. Persists to the Tauri keychain
// (file-based in Phase 1, OS keychain in Phase 2).

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { AuthResponse, User } from '../api/types';

interface AuthStoreState {
  accessToken: string | null;
  refreshToken: string | null;
  username: string | null;
  user: User | null;
}

interface AuthStoreActions {
  setAuth: (auth: AuthResponse) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadFromKeychain: () => Promise<boolean>;
  saveToKeychain: () => Promise<void>;
}

export const useAuthStore = create<AuthStoreState & AuthStoreActions>(
  (set, get) => ({
    accessToken: null,
    refreshToken: null,
    username: null,
    user: null,

    setAuth: async (auth: AuthResponse) => {
      set({
        accessToken: auth.access_token,
        refreshToken: auth.refresh_token,
        username: auth.user.username,
        user: auth.user,
      });
      // Persist to Tauri keychain
      try {
        await invoke('store_token', {
          accessToken: auth.access_token,
          refreshToken: auth.refresh_token,
          username: auth.user.username,
        });
      } catch (err) {
        console.error('Failed to save to keychain:', err);
      }
    },

    clearAuth: async () => {
      set({
        accessToken: null,
        refreshToken: null,
        username: null,
        user: null,
      });
      try {
        await invoke('clear_token');
      } catch (err) {
        console.error('Failed to clear keychain:', err);
      }
    },

    loadFromKeychain: async (): Promise<boolean> => {
      try {
        const stored = await invoke<{
          access_token: string;
          refresh_token: string;
          username: string;
        } | null>('get_token');

        if (stored) {
          set({
            accessToken: stored.access_token,
            refreshToken: stored.refresh_token,
            username: stored.username,
          });
          return true;
        }
      } catch (err) {
        console.error('Failed to load from keychain:', err);
      }
      return false;
    },

    saveToKeychain: async () => {
      const { accessToken, refreshToken, username } = get();
      if (!accessToken || !refreshToken || !username) return;
      try {
        await invoke('store_token', {
          accessToken,
          refreshToken,
          username,
        });
      } catch (err) {
        console.error('Failed to save to keychain:', err);
      }
    },
  }),
);
