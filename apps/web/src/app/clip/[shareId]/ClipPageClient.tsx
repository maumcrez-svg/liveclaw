'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ClipCard } from '@/components/clips/ClipCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ClipData {
  id: string;
  shareId: string;
  title: string;
  description: string | null;
  durationSeconds: number;
  status: string;
  viewCount: number;
  videoPath: string | null;
  thumbnailPath: string | null;
  createdAt: string;
  agent: {
    id: string;
    slug: string;
    name: string;
    avatarUrl: string | null;
    status: string;
  } | null;
  creator: {
    id: string;
    username: string;
    avatarUrl: string | null;
  } | null;
}

interface ClipPageClientProps {
  initialClip: ClipData | null;
  shareId: string;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ClipPageClient({ initialClip, shareId }: ClipPageClientProps) {
  const [clip] = useState<ClipData | null>(initialClip);
  const [moreClips, setMoreClips] = useState<ClipData[]>([]);
  const [copied, setCopied] = useState(false);

  const clipUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/clip/${shareId}`
      : `/clip/${shareId}`;

  // Fetch more clips from the same agent
  useEffect(() => {
    if (!clip?.agent?.id) return;
    fetch(`${API_URL}/clips/agent/${clip.agent.id}?limit=4`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res) => {
        const filtered = (res.data || []).filter(
          (c: ClipData) => c.shareId !== shareId,
        );
        setMoreClips(filtered.slice(0, 4));
      })
      .catch(() => {});
  }, [clip?.agent?.id, shareId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(clipUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleShareX = () => {
    const text = clip
      ? `${clip.title} - Watch ${clip.agent?.name || 'this agent'} on @goliveclaw`
      : 'Check out this clip on LiveClaw';
    window.open(
      `https://x.com/intent/tweet?url=${encodeURIComponent(clipUrl)}&text=${encodeURIComponent(text)}`,
      '_blank',
      'width=550,height=420',
    );
  };

  const handleShareTelegram = () => {
    const text = clip
      ? `${clip.title} - ${clip.agent?.name || 'Agent'} on LiveClaw`
      : 'Check out this clip on LiveClaw';
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(clipUrl)}&text=${encodeURIComponent(text)}`,
      '_blank',
    );
  };

  // Not found
  if (!clip) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Clip Not Found</h1>
          <p className="text-claw-text-muted mb-4">
            This clip may have been deleted or doesn&apos;t exist.
          </p>
          <Link
            href="/"
            className="text-claw-accent hover:underline text-sm font-semibold"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Still processing
  if (clip.status !== 'ready') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          {clip.status === 'failed' ? (
            <>
              <svg
                className="w-12 h-12 mx-auto mb-3 text-red-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <h1 className="text-xl font-bold mb-2">Clip Failed</h1>
              <p className="text-claw-text-muted text-sm">
                This clip couldn&apos;t be processed.
              </p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 mx-auto mb-3 border-3 border-claw-accent/30 border-t-claw-accent rounded-full animate-spin" />
              <h1 className="text-xl font-bold mb-2">Processing Clip</h1>
              <p className="text-claw-text-muted text-sm">
                This clip is still being processed. Check back shortly.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Video Player */}
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden mb-4 shadow-lg shadow-black/30">
        {clip.videoPath ? (
          <video
            src={`/clips-media/${clip.videoPath}`}
            controls
            autoPlay
            playsInline
            className="w-full h-full object-contain"
            poster={
              clip.thumbnailPath
                ? `/clips-media/${clip.thumbnailPath}`
                : undefined
            }
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-white/50">Video unavailable</p>
          </div>
        )}
      </div>

      {/* Title */}
      <h1 className="text-xl font-bold leading-tight mb-2">{clip.title}</h1>

      {/* Meta row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Agent info */}
        {clip.agent && (
          <Link
            href={`/${clip.agent.slug}`}
            className="flex items-center gap-2 group"
          >
            {clip.agent.avatarUrl ? (
              <img
                src={clip.agent.avatarUrl}
                alt={clip.agent.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-claw-card flex items-center justify-center text-claw-accent text-sm font-bold">
                {clip.agent.name[0]?.toUpperCase()}
              </div>
            )}
            <span className="text-sm font-semibold group-hover:text-claw-accent transition-colors">
              {clip.agent.name}
            </span>
            {clip.agent.status === 'live' && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-claw-live text-white rounded">
                LIVE
              </span>
            )}
          </Link>
        )}

        <span className="text-claw-text-muted/40">·</span>
        <span className="text-sm text-claw-text-muted">
          {formatViews(clip.viewCount)} views
        </span>
        <span className="text-claw-text-muted/40">·</span>
        <span className="text-sm text-claw-text-muted">
          {timeAgo(clip.createdAt)}
        </span>
        <span className="text-claw-text-muted/40">·</span>
        <span className="text-sm text-claw-text-muted">
          {formatDuration(clip.durationSeconds)}
        </span>
        {clip.creator && (
          <>
            <span className="text-claw-text-muted/40">·</span>
            <span className="text-sm text-claw-text-muted">
              Clipped by{' '}
              <span className="font-medium text-claw-text/80">
                {clip.creator.username}
              </span>
            </span>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        {clip.agent && (
          <Link
            href={`/${clip.agent.slug}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-claw-accent text-white hover:bg-claw-accent/90 transition-colors"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            {clip.agent.status === 'live' ? 'Watch Live' : 'Visit Channel'}
          </Link>
        )}

        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-claw-card border border-claw-border hover:bg-claw-surface transition-colors"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {copied ? 'Copied!' : 'Copy Link'}
        </button>

        <button
          onClick={handleShareX}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-claw-card border border-claw-border hover:bg-claw-surface transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Share on X
        </button>

        <button
          onClick={handleShareTelegram}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-claw-card border border-claw-border hover:bg-claw-surface transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
          Telegram
        </button>
      </div>

      {/* More clips section */}
      {moreClips.length > 0 && (
        <div>
          <div className="border-t border-claw-border pt-6">
            <h2 className="text-base font-bold mb-4">
              More clips from {clip.agent?.name || 'this agent'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {moreClips.map((c) => (
                <ClipCard key={c.shareId} clip={c} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
