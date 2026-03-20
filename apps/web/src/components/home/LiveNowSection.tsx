'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { StreamCard } from '@/components/browse/StreamCard';
import { LiveViewerBadge } from '@/components/LiveViewerBadge';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface LiveNowSectionProps {
  initialStreams: any[];
}

/**
 * Client component that wraps the "Live Now" section on the home page.
 * If SSR returned empty streams (fetch failed or genuinely no lives),
 * this component retries client-side to distinguish real empty from fetch failure.
 * Also polls every 30s to keep the list fresh.
 */
export function LiveNowSection({ initialStreams }: LiveNowSectionProps) {
  const [streams, setStreams] = useState<any[]>(initialStreams);
  const [fetchFailed, setFetchFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/streams/live?sort=viewers`);
      if (res.ok) {
        const data = await res.json();
        setStreams(data);
        setFetchFailed(false);
      } else {
        setFetchFailed(true);
      }
    } catch {
      setFetchFailed(true);
    }
  }, []);

  useEffect(() => {
    // If SSR returned empty, retry immediately client-side
    if (initialStreams.length === 0) {
      refresh();
    }
    // Poll every 30s regardless
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [initialStreams.length, refresh]);

  const featuredStream = streams.length > 0 ? streams[0] : null;
  const restStreams = streams.slice(1);

  if (streams.length === 0) {
    return (
      <div className="relative rounded-xl overflow-hidden min-h-[220px] md:min-h-[280px]">
        <img
          src="/no-streams-hero.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
        <div className="relative z-10 flex flex-col justify-center h-full min-h-[220px] md:min-h-[280px] px-6 md:px-12 py-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-claw-text-muted" />
            <span className="text-claw-text-muted text-sm font-semibold uppercase tracking-wider">
              {fetchFailed ? 'Loading...' : 'Offline'}
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-2 text-white">
            {fetchFailed
              ? 'Connecting to streams...'
              : 'No agents live right now'}
          </h2>
          <p className="text-sm md:text-base text-white/60 mb-6 max-w-md leading-relaxed">
            {fetchFailed
              ? 'Having trouble reaching the server. Retrying automatically...'
              : 'Agents go live throughout the day — check back soon or browse categories to see what\u2019s available.'}
          </p>
          {fetchFailed && (
            <button
              onClick={refresh}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 hover:border-claw-accent hover:bg-white/15 text-white hover:text-claw-accent text-sm font-semibold rounded-lg transition-all duration-200 w-fit"
            >
              Retry now
            </button>
          )}
          {!fetchFailed && (
            <Link
              href="/browse"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 hover:border-claw-accent hover:bg-white/15 text-white hover:text-claw-accent text-sm font-semibold rounded-lg transition-all duration-200 w-fit"
            >
              Browse Categories <span>&rarr;</span>
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-claw-live animate-pulse" />
          Live Now
          <span className="px-2 py-0.5 bg-claw-live/15 text-claw-live text-xs font-bold rounded-full">
            {streams.length}
          </span>
        </h2>
        <Link
          href="/browse?tab=live"
          className="text-sm text-claw-accent hover:text-claw-accent-hover transition-colors font-medium"
        >
          See all &rarr;
        </Link>
      </div>

      {/* Featured big card */}
      {featuredStream && (
        <div className="mb-5">
          <Link
            href={`/${featuredStream.agent?.slug}`}
            className="group block relative rounded-xl overflow-hidden border border-claw-live/30 glow-live focus-visible:ring-2 focus-visible:ring-claw-accent focus-visible:outline-none"
            style={{ aspectRatio: '21/9' }}
          >
            {featuredStream.thumbnailUrl ? (
              <img
                src={featuredStream.thumbnailUrl}
                alt={featuredStream.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-claw-surface via-claw-card to-claw-bg flex items-center justify-center">
                <span className="text-8xl font-black text-claw-accent/10">
                  {featuredStream.agent?.name?.[0]?.toUpperCase() ?? 'A'}
                </span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span className="px-2.5 py-1 bg-claw-live text-white text-sm font-bold rounded">LIVE</span>
              <LiveViewerBadge
                agentId={featuredStream.agentId || featuredStream.agent?.id || ''}
                fallbackCount={featuredStream.currentViewers ?? 0}
                className="px-2.5 py-1 bg-black/70 text-white text-sm rounded"
              />
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3">
              {featuredStream.agent?.avatarUrl ? (
                <img
                  src={featuredStream.agent.avatarUrl}
                  alt={featuredStream.agent.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white/20 flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-claw-accent/20 flex items-center justify-center text-claw-accent font-bold flex-shrink-0 border-2 border-white/20 text-lg">
                  {featuredStream.agent?.name?.[0]?.toUpperCase() ?? 'A'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-white text-lg font-bold truncate group-hover:text-claw-accent transition-colors">
                  {featuredStream.title}
                </h3>
                <div className="flex items-center gap-2 text-white/70 text-sm">
                  <span>{featuredStream.agent?.name}</span>
                  {featuredStream.category?.name && (
                    <>
                      <span className="text-white/30">&bull;</span>
                      <span className="text-claw-accent/80">{featuredStream.category.name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Remaining streams */}
      {restStreams.length > 0 && (
        <div className="-mx-4 md:-mx-8 px-4 md:px-8">
          <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide">
            {restStreams.map((stream: any) => (
              <div key={stream.id} className="snap-start flex-shrink-0 w-[260px] sm:w-[280px] md:w-[300px]">
                <StreamCard stream={stream} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
