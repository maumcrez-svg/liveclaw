'use client';

import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ClipCardProps {
  clip: {
    shareId: string;
    title: string;
    durationSeconds: number;
    viewCount: number;
    thumbnailPath: string | null;
    createdAt: string;
    creator?: {
      username: string;
    } | null;
    agent?: {
      slug: string;
      name: string;
      avatarUrl: string | null;
    } | null;
  };
  showAgent?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K views`;
  if (n === 1) return '1 view';
  return `${n} views`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function ClipCard({ clip, showAgent = false }: ClipCardProps) {
  const thumbUrl = clip.thumbnailPath
    ? `/clips-media/${clip.thumbnailPath}`
    : null;

  return (
    <Link
      href={`/clip/${clip.shareId}`}
      className="group block rounded-lg overflow-hidden bg-claw-card border border-claw-border hover:border-claw-accent/40 transition-all"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-claw-bg overflow-hidden">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={clip.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-claw-bg">
            <svg
              className="w-10 h-10 text-claw-text-muted/20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" />
            </svg>
          </div>
        )}
        {/* Duration badge */}
        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/80 text-white text-[11px] font-semibold rounded tabular-nums">
          {formatDuration(clip.durationSeconds)}
        </span>
      </div>

      {/* Info */}
      <div className="p-3">
        <h4 className="text-sm font-semibold leading-snug line-clamp-2 mb-1.5 group-hover:text-claw-accent transition-colors">
          {clip.title}
        </h4>
        <div className="flex items-center gap-1.5 text-xs text-claw-text-muted">
          {showAgent && clip.agent && (
            <>
              <span className="font-medium text-claw-text/80">
                {clip.agent.name}
              </span>
              <span>·</span>
            </>
          )}
          {clip.creator && (
            <>
              <span>Clipped by {clip.creator.username}</span>
              <span>·</span>
            </>
          )}
          <span>{formatViews(clip.viewCount)}</span>
          <span>·</span>
          <span>{timeAgo(clip.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
