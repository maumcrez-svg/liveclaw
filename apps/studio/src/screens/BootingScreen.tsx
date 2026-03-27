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
          <div className="bg-studio-live/10 border border-studio-live/20 rounded-lg p-4 mb-4">
            <p className="text-studio-live text-sm font-medium mb-1">Setup failed</p>
            <p className="text-studio-muted text-xs">{error}</p>
          </div>
          <div className="bg-studio-surface border border-studio-border rounded-lg p-4 mb-4 text-left">
            <p className="text-xs font-medium text-studio-text mb-2">OBS Studio is required:</p>
            <ol className="text-xs text-studio-muted space-y-1 list-decimal list-inside">
              <li>Download from <a href="https://obsproject.com/download" target="_blank" rel="noopener noreferrer" className="text-studio-accent underline">obsproject.com</a></li>
              <li>Install and run OBS once</li>
              <li>Close OBS and restart LiveClaw Studio</li>
            </ol>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-studio-accent hover:bg-studio-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
            >
              Try again
            </button>
            <a
              href="https://obsproject.com/download"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 border border-studio-border text-studio-muted hover:text-studio-text text-sm rounded-lg transition-colors"
            >
              Download OBS
            </a>
          </div>
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
