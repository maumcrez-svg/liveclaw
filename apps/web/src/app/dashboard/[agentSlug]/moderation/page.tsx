'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface Ban {
  id: string;
  userId: string;
  username: string;
  reason: string;
  type: string;
  expiresAt: string | null;
  createdAt: string;
}

export default function ModerationPage({ params }: { params: { agentSlug: string } }) {
  const { isLoggedIn, setShowLoginModal } = useUser();
  const [agent, setAgent] = useState<any>(null);
  const [bans, setBans] = useState<Ban[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Slow mode state
  const [slowModeEnabled, setSlowModeEnabled] = useState(false);
  const [slowModeSeconds, setSlowModeSeconds] = useState(5);
  const [savingSlowMode, setSavingSlowMode] = useState(false);

  // Unban loading state
  const [unbanningId, setUnbanningId] = useState<string | null>(null);

  const loadBans = useCallback(async (agentId: string) => {
    try {
      const data = await api(`/moderation/${agentId}/bans`);
      setBans(Array.isArray(data) ? data : []);
    } catch {
      setBans([]);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    async function load() {
      try {
        const agentData = await api(`/agents/${params.agentSlug}/private`);
        setAgent(agentData);
        await loadBans(agentData.id);
      } catch (err: any) {
        setError(err.status === 403 ? 'You do not have access to this agent.' : 'Failed to load agent.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isLoggedIn, params.agentSlug, loadBans]);

  const handleSaveSlowMode = async () => {
    if (!agent) return;
    setSavingSlowMode(true);
    try {
      await api(`/moderation/${agent.id}/slow-mode`, {
        method: 'POST',
        body: JSON.stringify({
          enabled: slowModeEnabled,
          seconds: slowModeSeconds,
        }),
      });
      toast.success(slowModeEnabled ? `Slow mode set to ${slowModeSeconds}s` : 'Slow mode disabled');
    } catch {
      toast.error('Failed to update slow mode');
    } finally {
      setSavingSlowMode(false);
    }
  };

  const handleUnban = async (ban: Ban) => {
    if (!agent) return;
    setUnbanningId(ban.id);
    try {
      await api(`/moderation/${agent.id}/ban/${ban.userId}`, {
        method: 'DELETE',
      });
      setBans((prev) => prev.filter((b) => b.id !== ban.id));
      toast.success(`Unbanned ${ban.username}`);
    } catch {
      toast.error('Failed to unban user');
    } finally {
      setUnbanningId(null);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-claw-text-muted mb-4">Log in to access moderation.</p>
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

  const activeBans = bans.filter(
    (b) => !b.expiresAt || new Date(b.expiresAt) > new Date()
  );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`/dashboard/${params.agentSlug}`}
          className="text-claw-text-muted hover:text-claw-text text-sm"
        >
          &larr; Back
        </Link>
        <h1 className="text-xl font-bold">
          Moderation &mdash; {agent.name}
        </h1>
      </div>

      {/* Slow Mode */}
      <section className="bg-claw-card border border-claw-border rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold mb-4">Slow Mode</h2>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={slowModeEnabled}
              onClick={() => setSlowModeEnabled(!slowModeEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                slowModeEnabled ? 'bg-claw-accent' : 'bg-claw-border'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  slowModeEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm">{slowModeEnabled ? 'Enabled' : 'Disabled'}</span>
          </label>

          {slowModeEnabled && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-claw-text-muted">Seconds:</label>
              <input
                type="number"
                min={1}
                max={300}
                value={slowModeSeconds}
                onChange={(e) => setSlowModeSeconds(Math.max(1, Math.min(300, Number(e.target.value))))}
                className="w-20 px-2 py-1 bg-claw-bg border border-claw-border rounded text-sm focus:border-claw-accent focus:outline-none"
              />
            </div>
          )}

          <button
            onClick={handleSaveSlowMode}
            disabled={savingSlowMode}
            className="px-4 py-1.5 bg-claw-accent text-white text-sm rounded font-semibold hover:bg-claw-accent-hover transition-colors disabled:opacity-50"
          >
            {savingSlowMode ? 'Saving...' : 'Save'}
          </button>
        </div>
      </section>

      {/* Active Bans */}
      <section className="bg-claw-card border border-claw-border rounded-lg p-5">
        <h2 className="text-base font-semibold mb-4">
          Active Bans
          {activeBans.length > 0 && (
            <span className="ml-2 text-xs font-normal text-claw-text-muted">({activeBans.length})</span>
          )}
        </h2>

        {activeBans.length === 0 ? (
          <div className="text-center py-8 text-claw-text-muted">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p className="text-sm">No active bans. All clear!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-claw-border text-left text-xs text-claw-text-muted uppercase tracking-wide">
                  <th className="pb-2 pr-4">User</th>
                  <th className="pb-2 pr-4">Reason</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {activeBans.map((ban) => (
                  <tr key={ban.id} className="border-b border-claw-border/50 last:border-0">
                    <td className="py-3 pr-4 font-medium">{ban.username}</td>
                    <td className="py-3 pr-4 text-claw-text-muted">{ban.reason || 'No reason'}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                        ban.type === 'permanent'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {ban.type || 'ban'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-claw-text-muted">
                      {new Date(ban.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleUnban(ban)}
                        disabled={unbanningId === ban.id}
                        className="px-3 py-1 text-xs border border-claw-border rounded hover:border-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        {unbanningId === ban.id ? 'Unbanning...' : 'Unban'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
