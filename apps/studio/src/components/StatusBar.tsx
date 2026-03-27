// ── Status bar ──────────────────────────────────────────────────────
//
// Fixed bottom bar showing OBS connection, agent name, and stream state.

import React, { useEffect, useRef } from 'react';
import { useOBSStore } from '../store/obs-store';
import { useAppStore } from '../store/app-store';
import { getOBS } from '../obs/connection';

export function StatusBar() {
  const connected = useOBSStore((s) => s.connected);
  const reconnecting = useOBSStore((s) => s.reconnecting);
  const streamActive = useOBSStore((s) => s.streamActive);
  const streamBytes = useOBSStore((s) => s.streamBytes);
  const streamDuration = useOBSStore((s) => s.streamDuration);
  const activeFps = useOBSStore((s) => s.activeFps);
  const droppedFrames = useOBSStore((s) => s.outputSkippedFrames);
  const appState = useAppStore((s) => s.state);
  const agentSlug = useAppStore((s) => s.selectedAgentSlug);

  const focusedRef = useRef(true);

  const stateLabel = getStateLabel(appState, streamActive);

  const bitrateKbps =
    streamActive && streamDuration > 0
      ? Math.round((streamBytes * 8) / (streamDuration / 1000) / 1000)
      : 0;

  // Pause polling when the app window is hidden / minimised
  useEffect(() => {
    const onFocus = () => { focusedRef.current = true; };
    const onBlur = () => { focusedRef.current = false; };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Poll OBS GetStats every 2s when connected
  useEffect(() => {
    if (!connected) return;
    const poll = async () => {
      if (!focusedRef.current) return;
      try {
        const obs = getOBS();
        const stats = await obs.call<{ activeFps: number; outputSkippedFrames: number }>('GetStats');
        useOBSStore.getState().setStats(
          Math.round(stats.activeFps),
          stats.outputSkippedFrames,
        );
      } catch { /* ignore */ }
    };
    poll();
    const timer = setInterval(poll, 2000);
    return () => clearInterval(timer);
  }, [connected]);

  return (
    <div className="fixed bottom-0 left-0 right-0 h-8 bg-studio-card border-t border-studio-border shadow-sm flex items-center px-3 text-xs text-studio-muted gap-4 z-40">
      {/* OBS connection indicator */}
      <div className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full transition-colors ${
            reconnecting
              ? 'bg-yellow-500 animate-pulse'
              : connected
              ? 'bg-studio-success'
              : 'bg-studio-live'
          }`}
        />
        <span>
          {reconnecting
            ? 'OBS Reconnecting...'
            : connected
            ? 'OBS Connected'
            : 'OBS Disconnected'}
        </span>
      </div>

      {/* Stats */}
      {connected && (
        <>
          <span className="text-studio-border">|</span>
          <span>{activeFps}fps</span>
          {streamActive && (
            <>
              <span>{bitrateKbps > 0 ? `${(bitrateKbps / 1000).toFixed(1)} Mb/s` : ''}</span>
              <span>{droppedFrames > 0 ? `${droppedFrames} dropped` : ''}</span>
            </>
          )}
        </>
      )}

      {/* Separator */}
      <span className="text-studio-border">|</span>

      {/* Agent name */}
      <span className="truncate">
        {agentSlug ? `Agent: ${agentSlug}` : 'No agent selected'}
      </span>

      {/* Spacer */}
      <span className="flex-1" />

      {/* Stream state */}
      <span className={streamActive ? 'text-studio-live font-medium' : ''}>
        {stateLabel}
      </span>
    </div>
  );
}

function getStateLabel(
  appState: string,
  streamActive: boolean,
): string {
  if (streamActive) return 'LIVE';
  switch (appState) {
    case 'detecting_obs':
      return 'Detecting OBS...';
    case 'obs_not_installed':
    case 'obs_not_running':
      return 'OBS Required';
    case 'launching_obs':
      return 'Launching OBS...';
    case 'connecting_obs':
      return 'Connecting...';
    case 'obs_auth_needed':
      return 'OBS Auth Needed';
    case 'checking_auth':
      return 'Checking login...';
    case 'login_required':
      return 'Login Required';
    case 'picking_agent':
      return 'Pick an Agent';
    case 'agent_home':
      return 'Agent Home';
    case 'configuring':
      return 'Configuring...';
    case 'ready':
      return 'Ready';
    case 'going_live':
      return 'Going Live...';
    case 'stopping':
      return 'Stopping...';
    case 'simple_studio':
      return 'Ready (Simple)';
    case 'simple_live':
      return 'LIVE';
    default:
      return 'Offline';
  }
}
