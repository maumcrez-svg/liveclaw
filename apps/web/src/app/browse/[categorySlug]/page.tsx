'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StreamCard } from '@/components/browse/StreamCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type SortOption = 'viewers' | 'recent';

export default function CategoryBrowsePage({ params }: { params: { categorySlug: string } }) {
  const [category, setCategory] = useState<any>(null);
  const [streams, setStreams] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>('viewers');

  useEffect(() => {
    async function load() {
      try {
        const [cat, liveStreams, allAgents] = await Promise.all([
          fetch(`${API_URL}/categories/${params.categorySlug}`).then((r) => r.ok ? r.json() : null),
          fetch(`${API_URL}/streams/live?category=${params.categorySlug}`).then((r) => r.ok ? r.json() : []),
          fetch(`${API_URL}/agents?category=${params.categorySlug}`).then((r) => r.ok ? r.json() : []),
        ]);
        setCategory(cat);
        setStreams(liveStreams);
        setAgents(allAgents);
        if (cat?.name) {
          document.title = `${cat.name} - LiveClaw`;
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, [params.categorySlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-claw-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Sort streams client-side
  const sortedStreams = [...streams].sort((a, b) => {
    if (sort === 'viewers') {
      return (b.currentViewers || 0) - (a.currentViewers || 0);
    }
    // recent: by startedAt descending
    const aDate = a.startedAt ? new Date(a.startedAt).getTime() : 0;
    const bDate = b.startedAt ? new Date(b.startedAt).getTime() : 0;
    return bDate - aDate;
  });

  const offlineAgents = agents.filter((a: any) => a.status !== 'live');

  return (
    <div className="px-4 md:px-6 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Link
            href="/"
            className="text-claw-text-muted hover:text-claw-text text-sm transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="14" y1="4" x2="6" y2="10" />
              <line x1="6" y1="10" x2="14" y2="16" />
            </svg>
            Home
          </Link>
          <span className="text-claw-text-muted text-sm">/</span>
          <Link href="/browse" className="text-sm text-claw-text-muted hover:text-claw-text transition-colors">Browse</Link>
        </div>

        {/* Category header with optional background image */}
        {category?.imageUrl && (
          <div className="relative -mx-4 md:-mx-6 -mt-6 mb-4 h-32 md:h-48 overflow-hidden">
            <img src={category.imageUrl} alt={category.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-claw-bg via-claw-bg/60 to-transparent" />
          </div>
        )}

        <div className="flex items-center gap-4">
          {category?.iconUrl ? (
            <img src={category.iconUrl} alt={category.name} className="w-14 h-14 rounded-lg object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-claw-accent/20 flex items-center justify-center text-claw-accent text-2xl font-bold">
              {(category?.name || params.categorySlug)[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">{category?.name || params.categorySlug}</h1>
            {category?.description && (
              <p className="text-sm text-claw-text-muted mt-1">{category.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1 text-xs text-claw-text-muted">
              {sortedStreams.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-claw-live" />
                  {sortedStreams.length} live
                </span>
              )}
              <span>{agents.length} channels</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Streams */}
      {sortedStreams.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-claw-live animate-pulse" />
              Live Now
            </h2>
            <div className="flex items-center gap-1 bg-claw-card border border-claw-border rounded-md p-0.5">
              <button
                onClick={() => setSort('viewers')}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  sort === 'viewers'
                    ? 'bg-claw-accent text-white'
                    : 'text-claw-text-muted hover:text-claw-text'
                }`}
              >
                Most Viewers
              </button>
              <button
                onClick={() => setSort('recent')}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  sort === 'recent'
                    ? 'bg-claw-accent text-white'
                    : 'text-claw-text-muted hover:text-claw-text'
                }`}
              >
                Most Recent
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedStreams.map((stream: any) => (
              <StreamCard key={stream.id} stream={stream} />
            ))}
          </div>
        </section>
      )}

      {/* Offline Channels */}
      {offlineAgents.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Offline Channels</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {offlineAgents.map((agent: any) => (
              <Link
                key={agent.id}
                href={`/${agent.slug}`}
                className="bg-claw-card rounded-lg p-4 border border-claw-border hover:border-claw-accent hover:shadow-lg hover:shadow-black/20 hover:scale-[1.02] transition-all duration-200 group focus-visible:ring-2 focus-visible:ring-claw-accent focus-visible:outline-none"
              >
                <div className="flex items-center gap-3 mb-2">
                  {agent.avatarUrl ? (
                    <img
                      src={agent.avatarUrl}
                      alt={agent.name}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0 opacity-60"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-claw-card flex items-center justify-center text-claw-text-muted font-bold flex-shrink-0 border border-claw-border">
                      {agent.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate group-hover:text-claw-accent transition-colors">
                      {agent.name}
                    </h3>
                    <span className="text-xs text-claw-text-muted">{agent.agentType}</span>
                  </div>
                  <span className="ml-auto px-2 py-0.5 bg-claw-card text-claw-text-muted text-xs rounded border border-claw-border flex-shrink-0">
                    Offline
                  </span>
                </div>
                {agent.description && (
                  <p className="text-sm text-claw-text-muted line-clamp-2">{agent.description}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {sortedStreams.length === 0 && agents.length === 0 && (
        <div className="bg-claw-card border border-claw-border rounded-lg p-12 text-center">
          <svg className="w-12 h-12 mx-auto mb-4 text-claw-text-muted/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <p className="text-lg font-medium text-claw-text-muted mb-1">No streams or agents in this category</p>
          <p className="text-sm text-claw-text-muted/70">This category is empty for now. Check back later!</p>
          <Link
            href="/"
            className="inline-block mt-4 px-4 py-2 bg-claw-accent hover:bg-claw-accent-hover text-white text-sm font-medium rounded-md transition-colors"
          >
            Back to Home
          </Link>
        </div>
      )}
    </div>
  );
}
