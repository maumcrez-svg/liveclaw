// ── App.tsx ─────────────────────────────────────────────────────────
//
// State-machine router with bundled OBS boot sequence.
// Flow: boot → download OBS (first run) → launch → connect WS → auth → studio

import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useAppStore } from './store/app-store';
import { useAuthStore } from './store/auth-store';
import { useOBSStore } from './store/obs-store';
import { refreshTokens, exchangeStudioToken } from './api/client';
import { getOBS } from './obs/connection';
import { useDeepLink } from './hooks/useDeepLink';

// Screens
import { BootingScreen } from './screens/BootingScreen';
import { ConnectOBSScreen } from './screens/ConnectOBSScreen';
import { LoginScreen } from './screens/LoginScreen';
import { AgentPickerScreen } from './screens/AgentPickerScreen';
import { StudioScreen } from './screens/StudioScreen';
import { LiveScreen } from './screens/LiveScreen';
import { AgentHomeScreen } from './screens/AgentHomeScreen';

// Components
import { StatusBar } from './components/StatusBar';
import { ErrorBanner } from './components/ErrorBanner';
import { ReconnectBanner } from './components/ReconnectBanner';
import { GoLiveCelebration } from './components/GoLiveCelebration';

export default function App() {
  const appState = useAppStore((s) => s.state);
  const agentSlug = useAppStore((s) => s.selectedAgentSlug);
  const [showCelebration, setShowCelebration] = useState(false);
  const prevStateRef = useRef(appState);
  const transition = useAppStore((s) => s.transition);
  const setObsProcessPid = useAppStore((s) => s.setObsProcessPid);
  const setDownloadStage = useAppStore((s) => s.setDownloadStage);
  const setObsPath = useOBSStore((s) => s.setObsPath);
  const loadFromKeychain = useAuthStore((s) => s.loadFromKeychain);
  const bootedRef = useRef(false);

  // Listen for deep links
  useDeepLink();

  // ── Offline detection ───────────────────────────────────────────
  useEffect(() => {
    const handleOffline = () => {
      useAppStore.getState().transition(
        useAppStore.getState().state,
        'You appear to be offline. Some features may not work.',
      );
    };
    const handleOnline = () => {
      useAppStore.getState().clearError();
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // ── Go Live celebration ───────────────────────────────────────
  useEffect(() => {
    if (appState === 'live' && prevStateRef.current === 'going_live') {
      setShowCelebration(true);
    }
    prevStateRef.current = appState;
  }, [appState]);

  // ── Boot sequence ───────────────────────────────────────────────
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    boot();
  }, []);

  // ── Global OBS callbacks ────────────────────────────────────────
  // Keep store in sync with actual OBS connection state (all platforms).
  useEffect(() => {
    const obs = getOBS();

    obs.onConnected = async () => {
      useOBSStore.getState().setConnected(true);
      useOBSStore.getState().setReconnecting(false);

      // Detect available input kinds from OBS
      try {
        const obsInner = getOBS();
        const res = await obsInner.call<{ inputKinds: string[] }>('GetInputKindList', { unversioned: true });
        useOBSStore.getState().setSupportedInputKinds(res.inputKinds);
        console.log('[OBS] Supported input kinds:', res.inputKinds);
      } catch (err) {
        console.warn('[OBS] Could not detect input kinds:', err);
      }
    };

    obs.onDisconnected = () => {
      useOBSStore.getState().setConnected(false);
    };

    obs.onReconnecting = (attempt: number) => {
      useOBSStore.getState().setReconnecting(true, attempt);
    };

    obs.onReconnectFailed = () => {
      useOBSStore.getState().setReconnecting(false);
      useOBSStore.getState().setConnected(false);
      useAppStore.getState().transition('booting', 'Lost connection to OBS. Restart the app to try again.');
    };

    obs.onStreamStateChanged = (active: boolean) => {
      if (active) {
        useAppStore.getState().transition('live');
      } else {
        useOBSStore.getState().resetStream();
        const s = useAppStore.getState().state;
        if (s === 'live') {
          useAppStore.getState().transition('ready', 'Stream ended unexpectedly. Check your connection and OBS.');
        } else if (s === 'stopping') {
          useAppStore.getState().transition('ready');
        }
      }
    };

    return () => {
      obs.onConnected = null;
      obs.onDisconnected = null;
      obs.onStreamStateChanged = null;
      obs.onReconnecting = null;
      obs.onReconnectFailed = null;
    };
  }, []);

  // Listen for OBS setup progress events
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<{ stage: string; detail: string }>('obs-setup-progress', (event) => {
      setDownloadStage(event.payload.detail);
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [setDownloadStage]);

  async function boot() {
    transition('booting');
    console.log('[boot] Starting...');

    // Step 1: Check if bundled OBS is ready
    try {
      const status = await invoke<{
        ready: boolean;
        obs_path: string | null;
        needs_download: boolean;
        platform_supported: boolean;
      }>('check_obs_portable');
      console.log('[boot] check_obs_portable result:', JSON.stringify(status));

      if (status.ready && status.obs_path) {
        setObsPath(status.obs_path);
        if (status.platform_supported) {
          // Windows/macOS: use bundled portable OBS
          await launchAndConnect(status.obs_path);
        } else {
          // Linux: use system OBS with WebSocket injection
          await fallbackSystemObs();
        }
        return;
      }

      if (!status.platform_supported) {
        // Linux: fall back to system OBS detection
        await fallbackSystemObs();
        return;
      }

      if (status.needs_download) {
        // First run: download OBS Portable
        transition('downloading_obs');
        try {
          const obsPath = await invoke<string>('setup_obs_portable');
          setObsPath(obsPath);
          await launchAndConnect(obsPath);
        } catch (err: any) {
          transition('booting', `Setup failed: ${err}`);
        }
        return;
      }
    } catch (err: any) {
      // Fallback to system OBS
      await fallbackSystemObs();
    }
  }

  async function fallbackSystemObs() {
    console.log('[fallbackSystemObs] Called');
    try {
      // Step 1: Detect OBS
      const result = await invoke<{ installed: boolean; path: string | null }>('detect_obs');
      console.log('[fallbackSystemObs] detect_obs:', JSON.stringify(result));
      if (!result.installed || !result.path) {
        transition('booting', 'OBS Studio not found. Install it from obsproject.com');
        return;
      }
      setObsPath(result.path);

      // Step 2: Launch OBS with WebSocket enabled (kills existing, fixes config, relaunches)
      try {
        await invoke('launch_obs', { path: result.path });
      } catch (err: any) {
        console.warn('launch_obs error (may be OK if OBS already running):', err);
      }

      // Step 3: Wait for OBS WebSocket to become available
      setDownloadStage('Waiting for OBS to start...');
      let connected = false;
      for (let i = 0; i < 20; i++) {
        setDownloadStage(`Connecting to OBS... (${i + 1}/20)`);
        await new Promise((r) => setTimeout(r, 1000));
        try {
          const obs = getOBS();
          await obs.connect();
          useOBSStore.getState().setConnected(true);
          connected = true;
          break;
        } catch {
          // retry
        }
      }

      if (connected) {
        transition('checking_auth');
      } else {
        transition('booting', 'Could not connect to OBS WebSocket on port 4455. Make sure OBS is running and the WebSocket plugin is enabled (Tools > WebSocket Server Settings).');
      }
    } catch (err: any) {
      transition('booting', `Failed: ${err}`);
    }
  }

  async function launchAndConnect(obsPath: string) {
    // Launch bundled OBS silently
    try {
      const pid = await invoke<number>('launch_bundled_obs');
      setObsProcessPid(pid);
    } catch {
      // OBS might already be running — that's fine, try connecting anyway
    }

    // Wait a moment for OBS to start its WebSocket server
    await new Promise((r) => setTimeout(r, 2000));
    transition('connecting_obs');
  }

  // ── Auto-advance: checking_auth ─────────────────────────────────
  useEffect(() => {
    if (appState !== 'checking_auth') return;

    (async () => {
      const { deepLinkToken, deepLinkAgent } = useAppStore.getState();

      // Priority 1: deep link token (one-time auth from website)
      if (deepLinkToken) {
        try {
          await exchangeStudioToken(deepLinkToken);
          useAppStore.getState().setDeepLinkToken(null);
          transition('picking_agent');
          return;
        } catch {
          // Token expired — fall through
        }
      }

      // Priority 2: stored tokens from keychain
      const hasStored = await loadFromKeychain();
      if (!hasStored) {
        transition('login_required');
        return;
      }

      // Validate via refresh
      try {
        const refreshed = await refreshTokens();
        transition(refreshed ? 'picking_agent' : 'login_required');
      } catch {
        transition('login_required');
      }
    })();
  }, [appState]);

  // ── Kill OBS on app quit (tray quit or window close) ─────────────
  useEffect(() => {
    const killObs = () => {
      const pid = useAppStore.getState().obsProcessPid;
      if (pid) {
        invoke('kill_obs_process', { pid }).catch(() => {});
      }
    };

    // Browser unload (safety net)
    window.addEventListener('beforeunload', killObs);

    // Tauri quit event from system tray
    let unlisten: (() => void) | undefined;
    listen('app-quit', () => { killObs(); })
      .then((fn) => { unlisten = fn; });

    return () => {
      window.removeEventListener('beforeunload', killObs);
      unlisten?.();
    };
  }, []);

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-studio-bg overflow-hidden select-none">
      <ErrorBanner />
      <ReconnectBanner />
      {showCelebration && (
        <GoLiveCelebration
          agentName={agentSlug || 'Your agent'}
          onComplete={() => setShowCelebration(false)}
        />
      )}
      <div className="flex-1 overflow-hidden">
        <div key={appState} className="h-full animate-fade-in-up">
          <ScreenRouter state={appState} />
        </div>
      </div>
      <StatusBar />
    </div>
  );
}

function ScreenRouter({ state }: { state: string }) {
  switch (state) {
    case 'booting':
    case 'downloading_obs':
      return <BootingScreen />;

    case 'connecting_obs':
    case 'obs_auth_needed':
      return <ConnectOBSScreen />;

    case 'checking_auth':
      return <AuthCheckingScreen />;
    case 'login_required':
      return <LoginScreen />;

    case 'picking_agent':
      return <AgentPickerScreen />;

    case 'agent_home':
      return <AgentHomeScreen />;

    case 'configuring':
    case 'ready':
    case 'going_live':
      return <StudioScreen />;

    case 'live':
    case 'stopping':
      return <LiveScreen />;

    default:
      return <BootingScreen />;
  }
}

function AuthCheckingScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-studio-border border-t-studio-accent rounded-full animate-spin" />
      <p className="text-studio-muted text-sm mt-4">Checking login...</p>
    </div>
  );
}
