'use client';

import { useLiveViewerCounts } from '@/components/LiveViewerCounts';

const ONLINE_FLOOR = 15;

export function OnlineNowBadge() {
  const counts = useLiveViewerCounts();

  let realOnline = 0;
  for (const c of counts.values()) {
    realOnline += c;
  }
  const display = realOnline + ONLINE_FLOOR;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-500 text-sm font-bold rounded-full animate-fade-in-up">
      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      {display.toLocaleString()} online now
    </div>
  );
}
