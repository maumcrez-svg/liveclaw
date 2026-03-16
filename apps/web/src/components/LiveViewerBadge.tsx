'use client';

import { useLiveViewerCounts } from '@/components/LiveViewerCounts';

interface LiveViewerBadgeProps {
  agentId: string;
  fallbackCount: number;
  className?: string;
}

export function LiveViewerBadge({ agentId, fallbackCount, className = '' }: LiveViewerBadgeProps) {
  const counts = useLiveViewerCounts();
  const count = counts.get(agentId) ?? fallbackCount;

  if (count <= 0) return null;

  return (
    <span className={className}>
      {count.toLocaleString()} viewers
    </span>
  );
}
