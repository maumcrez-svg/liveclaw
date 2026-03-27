// ── Connect OBS screen ──────────────────────────────────────────────
//
// Auto-connects to OBS WebSocket. On auth error shows password input.
// On connection refused, shows retry.

import React, { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../store/app-store';
import { useOBSStore } from '../store/obs-store';
import { getOBS } from '../obs/connection';
import logoImg from '../assets/logo-dark.png';

async function detectInputKinds() {
  try {
    const obs = getOBS();
    const res = await obs.call<{ inputKinds: string[] }>('GetInputKindList', { unversioned: true });
    useOBSStore.getState().setSupportedInputKinds(res.inputKinds);
    console.log('[ConnectOBS] Detected OBS input kinds:', res.inputKinds.length);
  } catch (err) {
    console.warn('[ConnectOBS] Could not detect input kinds:', err);
  }
}

export function ConnectOBSScreen() {
  const appState = useAppStore((s) => s.state);
  const transition = useAppStore((s) => s.transition);
  const obsPassword = useOBSStore((s) => s.obsPassword);
  const setObsPassword = useOBSStore((s) => s.setObsPassword);

  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState(obsPassword);
  const attemptedRef = useRef(false);

  const tryConnect = async (password?: string) => {
    setConnecting(true);
    setErrorMsg(null);

    const obs = getOBS();

    try {
      await obs.connect(password);
      // Detect available input kinds BEFORE transitioning so StudioScreen has them
      await detectInputKinds();
      // Global onConnected callback updates the store; we just transition.
      transition('checking_auth');
      return;
    } catch (err: any) {
      setConnecting(false);
      if (obs.state === 'auth_required') {
        transition('obs_auth_needed');
        return;
      }
      setErrorMsg("Can't reach OBS. Make sure it's open and WebSocket is enabled.");
    }
  };

  // Auto-attempt on mount (only once)
  useEffect(() => {
    if (appState === 'connecting_obs' && !attemptedRef.current) {
      attemptedRef.current = true;
      tryConnect(obsPassword || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setObsPassword(passwordInput);
    tryConnect(passwordInput);
  };

  const handleRetry = () => {
    attemptedRef.current = false;
    transition('connecting_obs');
    tryConnect(obsPassword || undefined);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <div className="mb-8">
        <img src={logoImg} alt="LiveClaw" className="h-10 w-auto mx-auto" draggable={false} />
      </div>

      {/* Connecting state */}
      {(appState === 'connecting_obs' && connecting) && (
        <div className="space-y-4">
          <div className="w-8 h-8 mx-auto border-2 border-studio-border border-t-studio-accent rounded-full animate-spin" />
          <p className="text-studio-text">Connecting to streaming engine...</p>
          <p className="text-studio-muted text-xs">
            Hang tight, this takes a few seconds
          </p>
        </div>
      )}

      {/* Connection error */}
      {(appState === 'connecting_obs' && !connecting && errorMsg) && (
        <div className="space-y-5 max-w-sm">
          <div className="w-16 h-16 mx-auto rounded-full bg-studio-card border border-studio-border flex items-center justify-center text-2xl text-studio-live">
            !
          </div>
          <h2 className="text-lg font-semibold text-studio-text">OBS not found</h2>
          <p className="text-studio-muted text-sm leading-relaxed max-w-sm">
            LiveClaw Studio needs OBS to stream. It tried to set it up automatically but couldn't connect.
          </p>
          <div className="bg-studio-surface border border-studio-border rounded-lg p-4 text-left max-w-sm">
            <p className="text-xs font-medium text-studio-text mb-2">How to fix:</p>
            <ol className="text-xs text-studio-muted space-y-1.5 list-decimal list-inside">
              <li>Download OBS Studio from <a href="https://obsproject.com" target="_blank" rel="noopener noreferrer" className="text-studio-accent hover:text-studio-accent-hover underline">obsproject.com</a></li>
              <li>Install and open OBS once (it will configure itself)</li>
              <li>Close OBS and click "Try again" below</li>
            </ol>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleRetry}
              className="px-5 py-2.5 bg-studio-accent hover:bg-studio-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
            >
              Try again
            </button>
            <a
              href="https://obsproject.com/download"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 border border-studio-border text-studio-muted hover:text-studio-text text-sm rounded-lg transition-colors inline-flex items-center"
            >
              Download OBS
            </a>
          </div>
        </div>
      )}

      {/* Auth needed */}
      {appState === 'obs_auth_needed' && (
        <div className="space-y-5 max-w-sm w-full">
          <h2 className="text-xl text-studio-text font-semibold">
            OBS wants a password
          </h2>
          <p className="text-studio-muted text-sm leading-relaxed">
            WebSocket authentication is enabled in OBS. Enter the password below — you can find it under Tools &gt; WebSocket Server Settings.
          </p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="OBS WebSocket password"
              autoFocus
              className="w-full bg-studio-bg border border-studio-border rounded px-3 py-2.5 text-sm text-studio-text placeholder-studio-muted/50 focus:outline-none focus:border-studio-accent"
            />
            {errorMsg && (
              <p className="text-sm text-studio-live">{errorMsg}</p>
            )}
            <button
              type="submit"
              disabled={connecting}
              className="w-full px-5 py-2.5 bg-studio-accent hover:bg-studio-accent-hover text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
            >
              {connecting ? 'Connecting...' : 'Unlock'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
