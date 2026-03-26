// ── Booting screen ──────────────────────────────────────────────────
//
// Shown during app startup and first-run OBS download.
// The user sees a branded splash with status text. Never sees "OBS".

import React from 'react';
import { useAppStore } from '../store/app-store';
import splashImg from '../assets/splash.png';
import logoImg from '../assets/logo-dark.png';

export function BootingScreen() {
  const appState = useAppStore((s) => s.state);
  const downloadStage = useAppStore((s) => s.downloadStage);
  const error = useAppStore((s) => s.error);

  const isDownloading = appState === 'downloading_obs';

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      {/* Brand logo */}
      <div className="mb-4">
        <img src={logoImg} alt="LiveClaw" className="h-8 w-auto mx-auto" draggable={false} />
      </div>
      {/* Splash mascot */}
      <div className="mb-6">
        <img
          src={splashImg}
          alt="LiveClaw Studio"
          className="w-72 h-auto mx-auto drop-shadow-2xl"
          draggable={false}
        />
      </div>

      {/* Status */}
      {error ? (
        <div className="text-center max-w-md">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-studio-card border border-studio-border rounded-lg text-sm hover:border-studio-accent transition-colors"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="text-center">
          {/* Spinner */}
          <div className="w-8 h-8 border-2 border-studio-border border-t-studio-accent rounded-full animate-spin mx-auto mb-4" />

          {/* Status text */}
          <p className="text-studio-muted text-sm">
            {isDownloading
              ? downloadStage || 'Getting everything ready...'
              : 'Warming up...'}
          </p>

          {/* First-run note */}
          {isDownloading && (
            <p className="text-studio-muted/60 text-xs mt-3 max-w-xs mx-auto">
              First launch downloads the streaming engine (~120 MB).
              Won't happen again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
