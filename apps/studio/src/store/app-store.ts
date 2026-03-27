// ── App state machine ───────────────────────────────────────────────
//
// Simplified for bundled OBS. The user never sees OBS setup screens.
// Boot: check/download OBS → launch → connect WS → auth → configure → ready

import { create } from 'zustand';

export type AppState =
  | 'booting'           // Launching bundled OBS + initial checks
  | 'downloading_obs'   // First run: downloading OBS Portable
  | 'connecting_obs'    // Waiting for OBS WebSocket
  | 'obs_auth_needed'   // OBS WebSocket requires password (rare)
  | 'checking_auth'     // Validating stored/exchanged tokens
  | 'login_required'    // No auth — show login form
  | 'picking_agent'     // Select which agent to stream
  | 'agent_home'        // Agent overview — start streaming, edit, dashboard
  | 'configuring'       // Auto-setup: stream key, video, scene, source
  | 'ready'             // Preview visible, Go Live enabled
  | 'going_live'        // StartStream in progress
  | 'live'              // Streaming
  | 'stopping'          // StopStream in progress
  | 'simple_studio'     // FFmpeg mode: preview + go live (no OBS)
  | 'simple_live';      // FFmpeg mode: streaming

interface AppStoreState {
  state: AppState;
  error: string | null;
  selectedAgentId: string | null;
  selectedAgentSlug: string | null;
  deepLinkAgent: string | null;
  deepLinkToken: string | null;
  obsProcessPid: number | null;
  downloadStage: string;
}

interface AppStoreActions {
  transition: (to: AppState, error?: string) => void;
  setAgent: (id: string, slug: string) => void;
  setDeepLinkAgent: (slug: string | null) => void;
  setDeepLinkToken: (token: string | null) => void;
  setObsProcessPid: (pid: number | null) => void;
  setDownloadStage: (stage: string) => void;
  clearError: () => void;
  reset: () => void;
}

const initialState: AppStoreState = {
  state: 'booting',
  error: null,
  selectedAgentId: null,
  selectedAgentSlug: null,
  deepLinkAgent: null,
  deepLinkToken: null,
  obsProcessPid: null,
  downloadStage: '',
};

export const useAppStore = create<AppStoreState & AppStoreActions>((set) => ({
  ...initialState,

  transition: (to, error) =>
    set({ state: to, error: error ?? null }),

  setAgent: (id, slug) =>
    set({ selectedAgentId: id, selectedAgentSlug: slug }),

  setDeepLinkAgent: (slug) =>
    set({ deepLinkAgent: slug }),

  setDeepLinkToken: (token) =>
    set({ deepLinkToken: token }),

  setObsProcessPid: (pid) =>
    set({ obsProcessPid: pid }),

  setDownloadStage: (stage) =>
    set({ downloadStage: stage }),

  clearError: () =>
    set({ error: null }),

  reset: () =>
    set(initialState),
}));
