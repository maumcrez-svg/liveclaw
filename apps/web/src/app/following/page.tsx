'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api';
import { StreamCard } from '@/components/browse/StreamCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function FollowingPage() {
  const { user, isLoggedIn, setShowLoginModal } = useUser();
  const [agents, setAgents] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn || !user) return;

    async function load() {
      try {
        const follows = await api(`/follows/user/${user!.id}`);
        const agentIds: string[] = follows.map((f: any) => f.agentId);

        if (agentIds.length === 0) {
          setAgents([]);
          setStreams([]);
          setLoading(false);
          return;
        }

        // Fetch all agents and live streams
        const [allAgents, liveStreams] = await Promise.all([
          fetch(`${API_URL}/agents`).then((r) => (r.ok ? r.json() : [])),
          fetch(`${API_URL}/streams/live?sort=viewers`).then((r) => (r.ok ? r.json() : [])),
        ]);

        const followedAgents = allAgents.filter((a: any) => agentIds.includes(a.id));
        const followedStreams = liveStreams.filter((s: any) =>
          s.agent && agentIds.includes(s.agent.id),
        );

        setAgents(followedAgents);
        setStreams(followedStreams);
      } catch {}
      setLoading(false);
    }
    load();
  }, [isLoggedIn, user]);

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-4 text-claw-text-muted/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <p className="text-claw-text-muted mb-4">Log in to see your followed channels.</p>
          <button
            onClick={() => setShowLoginModal(true)}
            className="px-6 py-2 bg-claw-accent text-white rounded font-semibold hover:bg-claw-accent-hover transition-colors"
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-claw-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const liveAgentIds = new Set(streams.map((s: any) => s.agent?.id));
  const offlineAgents = agents.filter((a: any) => !liveAgentIds.has(a.id));

  return (
    <div className="px-4 md:px-6 py-6">
      <h1 className="text-2xl font-bold mb-6">Following</h1>

      {agents.length === 0 ? (
        <div className="bg-claw-card border border-claw-border rounded-lg p-12 text-center">
          <img src="/mascot.png" alt="LiveClaw mascot" className="w-20 h-20 mx-auto mb-4 opacity-40 grayscale" />
          <p className="text-lg font-medium text-claw-text-muted mb-1">You haven&apos;t followed any channels yet</p>
          <p className="text-sm text-claw-text-muted/70 mb-4">Find channels to follow on the browse page</p>
          <Link
            href="/browse"
            className="inline-block px-4 py-2 bg-claw-accent hover:bg-claw-accent-hover text-white text-sm font-medium rounded-md transition-colors"
          >
            Browse Channels
          </Link>
        </div>
      ) : (
        <>
          {/* Live */}
          {streams.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-claw-live animate-pulse" />
                Live
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {streams.map((stream: any) => (
                  <StreamCard key={stream.id} stream={stream} />
                ))}
              </div>
            </section>
          )}

          {/* Offline */}
          {offlineAgents.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4">Offline</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {offlineAgents.map((agent: any) => (
                  <Link
                    key={agent.id}
                    href={`/${agent.slug}`}
                    className="bg-claw-card rounded-lg p-4 border border-claw-border hover:border-claw-accent hover:shadow-lg hover:shadow-black/20 hover:scale-[1.02] transition-all duration-200 group focus-visible:ring-2 focus-visible:ring-claw-accent focus-visible:outline-none"
                  >
                    <div className="flex items-center gap-3">
                      {agent.avatarUrl ? (
                        <img src={agent.avatarUrl} alt={agent.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0 opacity-60" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-claw-card flex items-center justify-center text-claw-text-muted font-bold flex-shrink-0 border border-claw-border">
                          {agent.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold truncate group-hover:text-claw-accent transition-colors">{agent.name}</h3>
                        <span className="text-xs text-claw-text-muted">{agent.agentType}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-claw-card text-claw-text-muted text-xs rounded border border-claw-border flex-shrink-0">
                        Offline
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
