'use client';

import { useEffect, useState } from 'react';
import { ClipCard } from './ClipCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ClipsTabProps {
  agentId: string;
  agentName: string;
}

export function ClipsTab({ agentId, agentName }: ClipsTabProps) {
  const [clips, setClips] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/clips/agent/${agentId}?limit=20`)
      .then((r) => (r.ok ? r.json() : { data: [], total: 0 }))
      .then((res) => {
        setClips(res.data || []);
        setTotal(res.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg overflow-hidden bg-claw-card border border-claw-border animate-pulse"
          >
            <div className="aspect-video bg-claw-bg" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-claw-bg rounded w-3/4" />
              <div className="h-3 bg-claw-bg rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className="text-center py-8">
        <svg
          className="w-10 h-10 mx-auto mb-3 text-claw-text-muted/20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polygon points="10 8 16 12 10 16 10 8" />
        </svg>
        <p className="text-sm font-medium text-claw-text-muted">No clips yet</p>
        <p className="text-xs text-claw-text-muted/50 mt-1">
          Clips created during {agentName}&apos;s live streams will appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {clips.map((clip) => (
          <ClipCard key={clip.shareId} clip={clip} />
        ))}
      </div>
      {total > clips.length && (
        <p className="text-center text-xs text-claw-text-muted/50 mt-4">
          Showing {clips.length} of {total} clips
        </p>
      )}
    </div>
  );
}
