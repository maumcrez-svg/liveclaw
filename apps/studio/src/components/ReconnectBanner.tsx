// ── Reconnect banner ─────────────────────────────────────────────────

import React from 'react';
import { useOBSStore } from '../store/obs-store';

export function ReconnectBanner() {
  const reconnecting = useOBSStore((s) => s.reconnecting);
  const attempt = useOBSStore((s) => s.reconnectAttempt);

  if (!reconnecting) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-40 flex items-center gap-2 px-4 py-2 bg-yellow-600/90 text-white text-sm backdrop-blur-sm animate-slide-down">
      <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0" />
      <span>OBS connection lost. Reconnecting{attempt > 1 ? ` (attempt ${attempt})` : ''}...</span>
    </div>
  );
}
