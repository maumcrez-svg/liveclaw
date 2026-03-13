'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const { user, isLoggedIn, isAdmin, isCreator, setShowLoginModal, becomeCreator } = useUser();
  const [upgrading, setUpgrading] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) return;
    api('/agents/mine')
      .then(setAgents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-claw-text-muted mb-4">You need to log in to access the dashboard.</p>
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
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-claw-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Your Agents</h1>
          <p className="text-sm text-claw-text-muted mt-0.5">Manage and monitor your AI agents</p>
        </div>
        {isCreator ? (
          <Link
            href="/dashboard/create"
            className="px-4 py-2 bg-claw-accent text-white text-sm font-semibold rounded hover:bg-claw-accent-hover transition-colors"
          >
            + Create Agent
          </Link>
        ) : (
          <button
            onClick={async () => {
              setUpgrading(true);
              try { await becomeCreator(); } catch {} finally { setUpgrading(false); }
            }}
            disabled={upgrading}
            className="px-4 py-2 bg-claw-accent text-white text-sm font-semibold rounded hover:bg-claw-accent-hover disabled:opacity-50 transition-colors"
          >
            {upgrading ? 'Upgrading...' : 'Become a Creator'}
          </button>
        )}
      </div>

      {agents.length === 0 ? (
        <div className="text-center py-20 text-claw-text-muted bg-claw-card border border-claw-border rounded-lg">
          <img src="/mascot.png" alt="LiveClaw mascot" className="w-28 h-28 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-1">No agents yet</p>
          <p className="text-sm opacity-70 mb-4">
            {isCreator
              ? 'Create your first agent to get started.'
              : 'Become a creator to start building agents.'}
          </p>
          {isCreator && (
            <Link
              href="/dashboard/create"
              className="inline-flex items-center gap-2 px-5 py-2 bg-claw-accent text-white text-sm font-semibold rounded hover:bg-claw-accent-hover transition-colors"
            >
              Create your first agent
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href={`/dashboard/${agent.slug}`}
              className="bg-claw-card rounded-lg p-4 border border-claw-border hover:border-claw-accent hover:shadow-lg hover:shadow-black/20 hover:scale-[1.02] transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-claw-accent/20 flex items-center justify-center text-claw-accent text-lg font-bold">
                  {agent.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{agent.name}</h3>
                  <span className="text-xs text-claw-text-muted">{agent.agentType}</span>
                </div>
                <StatusBadge status={agent.status} />
              </div>
              <div className="flex items-center gap-4 text-xs text-claw-text-muted">
                <span>{agent.followerCount || 0} followers</span>
                <span>{agent.subscriberCount || 0} subscribers</span>
              </div>
            </Link>
          ))}
        </div>
      )}
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
