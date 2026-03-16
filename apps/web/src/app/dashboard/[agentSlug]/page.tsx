'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api';
import { formatCount, formatCurrency } from '@/lib/format';

export default function AgentDashboardPage({ params }: { params: { agentSlug: string } }) {
  const { isLoggedIn, setShowLoginModal } = useUser();
  const [agent, setAgent] = useState<any>(null);
  const [streams, setStreams] = useState<any[]>([]);
  const [donationStats, setDonationStats] = useState<any>(null);
  const [subStats, setSubStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    async function load() {
      try {
        const agentData = await api(`/agents/${params.agentSlug}/private`);
        setAgent(agentData);
        const [streamData, dStats, sStats] = await Promise.all([
          api(`/streams/agent/${agentData.id}`),
          api(`/donations/agent/${agentData.id}/stats`).catch(() => null),
          api(`/subscriptions/agent/${agentData.id}/stats`).catch(() => null),
        ]);
        setStreams(Array.isArray(streamData) ? streamData.slice(0, 10) : []);
        setDonationStats(dStats);
        setSubStats(sStats);
      } catch (err: any) {
        setError(err.status === 403 ? 'You do not have access to this agent.' : 'Failed to load agent.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isLoggedIn, params.agentSlug]);

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-claw-text-muted mb-4">Log in to access the dashboard.</p>
          <button onClick={() => setShowLoginModal(true)} className="px-6 py-2 bg-claw-accent text-white rounded font-semibold">
            Log In
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-claw-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-claw-text-muted">{error || 'Agent not found'}</p>
      </div>
    );
  }

  const peakViewers = streams.reduce((max: number, s: any) => Math.max(max, s.peakViewers || 0), 0);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-claw-accent/20 flex items-center justify-center text-claw-accent text-2xl font-bold">
          {agent.name[0]?.toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {agent.name}
            <StatusBadge status={agent.status} />
          </h1>
          <p className="text-sm text-claw-text-muted">{agent.description || 'No description'}</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard
          label="Followers"
          value={formatCount(agent.followerCount || 0)}
          icon={
            <svg className="w-5 h-5 text-claw-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          }
        />
        <StatCard
          label="Subscribers"
          value={formatCount(agent.subscriberCount || 0)}
          icon={
            <svg className="w-5 h-5 text-claw-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          }
        />
        <StatCard
          label="Total Streams"
          value={formatCount(streams.length)}
          icon={
            <svg className="w-5 h-5 text-claw-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          label="Peak Viewers"
          value={formatCount(peakViewers)}
          icon={
            <svg className="w-5 h-5 text-claw-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        />
        <StatCard
          label="Revenue"
          value={formatCurrency(donationStats?.totalAmount || 0)}
          icon={
            <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="MRR"
          value={formatCurrency(subStats?.mrr || 0)}
          icon={
            <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <Link
          href={`/dashboard/${params.agentSlug}/settings`}
          className="flex items-center gap-2 px-4 py-3 bg-claw-card border border-claw-border rounded-lg hover:border-claw-accent/50 transition-colors text-sm font-medium text-claw-text-muted hover:text-claw-text"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </Link>
        <Link
          href={`/dashboard/${params.agentSlug}/stream`}
          className="flex items-center gap-2 px-4 py-3 bg-claw-card border border-claw-border rounded-lg hover:border-claw-accent/50 transition-colors text-sm font-medium text-claw-text-muted hover:text-claw-text"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Stream Control
        </Link>
        <Link
          href={`/${params.agentSlug}`}
          className="flex items-center gap-2 px-4 py-3 bg-claw-card border border-claw-border rounded-lg hover:border-claw-accent/50 transition-colors text-sm font-medium text-claw-text-muted hover:text-claw-text"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          View Channel
        </Link>
      </div>

      {/* Stream Key (external mode) */}
      {agent.streamingMode === 'external' && agent.streamKey && (
        <StreamKeyCard streamKey={agent.streamKey} />
      )}

      {/* Recent Donations */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Recent Donations</h2>
        {donationStats?.recent?.length > 0 ? (
          <div className="space-y-2">
            {donationStats.recent.slice(0, 10).map((d: any) => (
              <div key={d.id} className="bg-claw-card border border-claw-border rounded p-3 flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-600/20 flex items-center justify-center text-yellow-400 text-sm font-bold">
                  E
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {d.user?.username || 'Anonymous'} donated {formatCurrency(parseFloat(d.amount))}
                  </p>
                  {d.message && <p className="text-xs text-claw-text-muted truncate">{d.message}</p>}
                </div>
                <span className="text-xs text-claw-text-muted flex-shrink-0">
                  {new Date(d.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-claw-text-muted bg-claw-card border border-claw-border rounded-lg">
            <img src="/mascot.png" alt="" className="w-14 h-14 mx-auto mb-2 opacity-20 grayscale" />
            <p className="text-sm">No donations yet</p>
          </div>
        )}
      </div>

      {/* Recent streams */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Streams</h2>
        {streams.length === 0 ? (
          <div className="text-center py-12 text-claw-text-muted bg-claw-card border border-claw-border rounded-lg">
            <img src="/mascot.png" alt="" className="w-16 h-16 mx-auto mb-3 opacity-25 grayscale" />
            <p className="text-sm">No streams yet. Start your first stream!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {streams.map((s) => (
              <div key={s.id} className="bg-claw-card border border-claw-border rounded p-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.title}</p>
                  <p className="text-xs text-claw-text-muted">
                    {new Date(s.startedAt).toLocaleDateString()} — Peak: {s.peakViewers} viewers
                  </p>
                </div>
                {s.isLive && (
                  <span className="px-2 py-0.5 bg-claw-live text-white text-xs font-bold rounded">LIVE</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="bg-claw-card border border-claw-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-claw-text-muted uppercase tracking-wide">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function StreamKeyCard({ streamKey }: { streamKey: string }) {
  const [copied, setCopied] = useState(false);
  const truncated = streamKey.slice(0, 8) + '...' + streamKey.slice(-4);

  return (
    <div className="mb-8 bg-claw-card border border-claw-border rounded-lg p-4 flex items-center justify-between">
      <div>
        <p className="text-xs text-claw-text-muted uppercase tracking-wide mb-1">Stream Key</p>
        <code className="text-sm font-mono text-claw-text">{truncated}</code>
      </div>
      <button
        onClick={() => {
          navigator.clipboard.writeText(streamKey);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="px-3 py-1.5 text-xs font-medium bg-claw-accent/10 text-claw-accent rounded hover:bg-claw-accent/20 transition-colors"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    live: 'bg-claw-live text-white',
    starting: 'bg-yellow-600 text-white',
    error: 'bg-red-600 text-white',
    offline: 'bg-claw-card text-claw-text-muted border border-claw-border',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-bold rounded uppercase ${colors[status] || colors.offline}`}>
      {status}
    </span>
  );
}
