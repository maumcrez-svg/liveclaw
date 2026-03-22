'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLiveViewerCounts } from '@/components/LiveViewerCounts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface StreamCardProps {
  stream: {
    id: string;
    title: string;
    tags: string[];
    currentViewers?: number;
    thumbnailUrl?: string | null;
    startedAt?: string | null;
    category?: { name: string; slug: string } | null;
    agent?: {
      id?: string;
      slug: string;
      name: string;
      agentType: string;
      avatarUrl: string | null;
      status: string;
    };
  };
  featured?: boolean;
}

function resolveThumbnailUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Already absolute
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Relative path from API — prepend API_URL
  return `${API_URL}${url}`;
}

function formatUptime(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const diffMs = now - start;
  if (diffMs < 0) return '';

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function StreamCard({ stream, featured = false }: StreamCardProps) {
  const agent = stream.agent;
  const [imgError, setImgError] = useState(false);
  const viewerCounts = useLiveViewerCounts();
  if (!agent) return null;

  // Prefer real-time count from Socket.IO, fall back to DB value
  const agentId = (stream as any).agentId ?? stream.agent?.id ?? '';
  const liveViewers = viewerCounts.get(agentId) ?? stream.currentViewers ?? 0;

  const thumbSrc = resolveThumbnailUrl(stream.thumbnailUrl);
  const showImage = thumbSrc && !imgError;

  return (
    <Link href={`/${agent.slug}`} className={`group focus-visible:ring-2 focus-visible:ring-claw-accent focus-visible:outline-none rounded-lg ${featured ? 'h-full' : ''}`}>
      <div className={`bg-claw-card rounded-lg overflow-hidden border border-claw-border hover:border-claw-accent transition-all duration-200 group-hover:scale-[1.02] group-hover:shadow-lg group-hover:shadow-black/20 ${featured ? 'h-full flex flex-col' : ''}`}>
        {/* Thumbnail */}
        <div className={`${featured ? 'aspect-[16/10]' : 'aspect-video'} bg-claw-bg relative`}>
          {showImage ? (
            <img
              src={thumbSrc}
              alt={stream.title}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-claw-text-muted">
              <span className={`font-bold opacity-20 ${featured ? 'text-6xl' : 'text-4xl'}`}>
                {agent.name[0]?.toUpperCase()}
              </span>
            </div>
          )}

          {/* Top-left badges: LIVE + viewers */}
          <div className="absolute top-2 left-2 flex items-center gap-2">
            <span className={`px-2 py-0.5 bg-claw-live text-white font-bold rounded ${featured ? 'text-sm' : 'text-xs'}`}>
              LIVE
            </span>
            {liveViewers > 0 && (
              <span className={`px-2 py-0.5 bg-black/70 text-white rounded ${featured ? 'text-sm' : 'text-xs'}`}>
                {liveViewers.toLocaleString()} viewers
              </span>
            )}
          </div>

          {/* Top-right: uptime badge */}
          {stream.startedAt && (
            <div className="absolute top-2 right-2">
              <span className="px-2 py-0.5 bg-black/70 text-white text-xs rounded">
                {formatUptime(stream.startedAt)}
              </span>
            </div>
          )}

          {/* Bottom-left: avatar */}
          <div className="absolute bottom-2 left-2">
            {agent.avatarUrl ? (
              <img
                src={agent.avatarUrl}
                alt={agent.name}
                className={`rounded-full object-cover border-2 border-claw-surface ${featured ? 'w-10 h-10' : 'w-8 h-8'}`}
              />
            ) : (
              <div className={`rounded-full bg-claw-accent/20 flex items-center justify-center text-claw-accent font-bold border-2 border-claw-surface ${featured ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs'}`}>
                {agent.name[0]?.toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className={`${featured ? 'p-4' : 'p-3'}`}>
          <div className="min-w-0">
            <h3 className={`font-semibold truncate group-hover:text-claw-accent transition-colors ${featured ? 'text-base' : 'text-sm'}`}>
              {stream.title}
            </h3>
            <p className={`text-claw-text-muted ${featured ? 'text-sm' : 'text-xs'}`}>{agent.name}</p>
            {stream.category && (
              <p className={`text-claw-accent/70 mt-0.5 ${featured ? 'text-sm' : 'text-xs'}`}>{stream.category.name}</p>
            )}
          </div>
          {stream.tags?.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {stream.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-claw-bg text-claw-text-muted text-xs rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
