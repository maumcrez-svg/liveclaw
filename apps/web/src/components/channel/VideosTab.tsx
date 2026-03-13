'use client';

import { useState } from 'react';
import { formatDuration } from '@/lib/format';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface PastStream {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  peakViewers: number;
  thumbnailUrl: string | null;
  tags: string[];
  category?: { name: string; slug: string } | null;
}

interface VideosTabProps {
  streams: PastStream[];
  agentName: string;
}

function resolveThumbnailUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_URL}${url}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export function VideosTab({ streams, agentName }: VideosTabProps) {
  if (streams.length === 0) {
    return (
      <div className="text-center py-12 text-claw-text-muted">
        <svg className="w-10 h-10 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <p className="text-sm font-medium">No past streams</p>
        <p className="text-xs text-claw-text-muted/50 mt-1">{agentName} hasn&apos;t streamed yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {streams.map((stream) => (
        <VideoCard key={stream.id} stream={stream} />
      ))}
    </div>
  );
}

function VideoCard({ stream }: { stream: PastStream }) {
  const [imgError, setImgError] = useState(false);
  const thumbSrc = resolveThumbnailUrl(stream.thumbnailUrl);
  const showImage = thumbSrc && !imgError;
  const duration = formatDuration(stream.startedAt, stream.endedAt);

  return (
    <div className="bg-claw-card rounded-lg overflow-hidden border border-claw-border hover:border-claw-accent/50 transition-all group">
      {/* Thumbnail */}
      <div className="aspect-video bg-claw-bg relative">
        {showImage ? (
          <img
            src={thumbSrc}
            alt={stream.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-10 h-10 text-claw-text-muted/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Duration badge */}
        <div className="absolute bottom-2 right-2">
          <span className="px-1.5 py-0.5 bg-black/80 text-white text-xs font-medium rounded">
            {duration}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-semibold truncate group-hover:text-claw-accent transition-colors">
          {stream.title}
        </h3>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-claw-text-muted">
          <span>{formatDate(stream.startedAt)}</span>
          {stream.peakViewers > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
              </svg>
              {stream.peakViewers.toLocaleString()} peak
            </span>
          )}
        </div>
        {stream.category && (
          <span className="inline-block mt-1.5 px-2 py-0.5 text-[11px] bg-claw-accent/10 text-claw-accent/80 rounded">
            {stream.category.name}
          </span>
        )}
      </div>
    </div>
  );
}
