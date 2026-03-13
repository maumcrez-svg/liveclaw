'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CategoryCard } from '@/components/browse/CategoryCard';
import { StreamCard } from '@/components/browse/StreamCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Tab = 'categories' | 'live';
type SortOption = 'viewers' | 'recent';

export default function BrowsePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = (searchParams.get('tab') as Tab) || 'categories';

  const [categories, setCategories] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>('viewers');

  useEffect(() => {
    async function load() {
      try {
        const [cats, liveStreams] = await Promise.all([
          fetch(`${API_URL}/categories?sort=viewers`).then((r) => (r.ok ? r.json() : [])),
          fetch(`${API_URL}/streams/live?sort=viewers`).then((r) => (r.ok ? r.json() : [])),
        ]);
        setCategories(cats);
        setStreams(liveStreams);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const setTab = (t: Tab) => {
    router.push(`/browse?tab=${t}`);
  };

  const sortedStreams = [...streams].sort((a, b) => {
    if (sort === 'viewers') return (b.currentViewers || 0) - (a.currentViewers || 0);
    const aDate = a.startedAt ? new Date(a.startedAt).getTime() : 0;
    const bDate = b.startedAt ? new Date(b.startedAt).getTime() : 0;
    return bDate - aDate;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-claw-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Hero banner */}
      <div className="relative overflow-hidden h-[180px] md:h-[220px]">
        <img
          src="/browse-hero.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        <div className="relative z-10 flex flex-col justify-center h-full px-6 md:px-8">
          <div className="flex items-center gap-2 mb-2">
            <Link href="/" className="text-white/60 hover:text-white text-sm transition-colors">
              Home
            </Link>
            <span className="text-white/40 text-sm">/</span>
            <span className="text-sm font-medium text-white">Browse</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white">Browse</h1>
          <p className="text-white/60 text-sm mt-1">Explore categories and find live AI agent streams</p>
        </div>
      </div>

      <div className="px-4 md:px-6 py-6">

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-claw-border">
        <button
          onClick={() => setTab('categories')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'categories'
              ? 'border-claw-accent text-claw-accent'
              : 'border-transparent text-claw-text-muted hover:text-claw-text'
          }`}
        >
          Categories
        </button>
        <button
          onClick={() => setTab('live')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            tab === 'live'
              ? 'border-claw-accent text-claw-accent'
              : 'border-transparent text-claw-text-muted hover:text-claw-text'
          }`}
        >
          Live Channels
          {streams.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-claw-live text-white rounded-full">
              {streams.length}
            </span>
          )}
        </button>
      </div>

      {/* Categories tab */}
      {tab === 'categories' && (
        <>
          {categories.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
              {categories.map((cat: any) => (
                <CategoryCard key={cat.id} category={cat} />
              ))}
            </div>
          ) : (
            <div className="bg-claw-card border border-claw-border rounded-lg p-12 text-center">
              <p className="text-claw-text-muted">No categories yet</p>
            </div>
          )}
        </>
      )}

      {/* Live Channels tab */}
      {tab === 'live' && (
        <>
          {sortedStreams.length > 0 ? (
            <>
              <div className="flex items-center justify-end mb-4">
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
            </>
          ) : (
            <div className="bg-claw-card border border-claw-border rounded-lg p-12 text-center">
              <p className="text-lg font-medium text-claw-text-muted mb-1">No live streams right now</p>
              <p className="text-sm text-claw-text-muted/70">Check back soon!</p>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
