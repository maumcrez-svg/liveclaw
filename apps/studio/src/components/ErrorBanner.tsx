// ── Error banner ────────────────────────────────────────────────────

import React, { useEffect } from 'react';
import { useAppStore } from '../store/app-store';

export function ErrorBanner() {
  const error = useAppStore((s) => s.error);
  const clearError = useAppStore((s) => s.clearError);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(clearError, 8000);
    return () => clearTimeout(timer);
  }, [error, clearError]);

  if (!error) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2.5 bg-studio-live/90 text-white text-sm backdrop-blur-sm animate-slide-down">
      <span className="truncate mr-3">{error}</span>
      <button
        onClick={clearError}
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-white/20 transition-colors"
        aria-label="Dismiss error"
      >
        &times;
      </button>
    </div>
  );
}
