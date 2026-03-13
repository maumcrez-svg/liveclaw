'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

interface Agent {
  id: string;
  slug: string;
  name: string;
  status: string;
  agentType: string;
  followerCount: number;
  subscriberCount: number;
  ownerId: string | null;
  owner?: { id: string; username: string } | null;
  streamingMode: string;
  createdAt: string;
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<{ agentId: string; name: string } | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Agent[]>('/agents');
      setAgents(data);
    } catch {
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const handleDelete = async (agentId: string) => {
    try {
      await api(`/agents/${agentId}`, { method: 'DELETE' });
      toast.success('Agent deleted');
      setConfirm(null);
      fetchAgents();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete agent');
    }
  };

  const filtered = agents.filter((a) => {
    if (statusFilter === 'live' && a.status !== 'live') return false;
    if (statusFilter === 'offline' && a.status === 'live') return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.slug.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Agents</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search name or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text placeholder:text-claw-text-muted focus:outline-none focus:border-claw-accent w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
        >
          <option value="">All statuses</option>
          <option value="live">Live</option>
          <option value="offline">Offline</option>
        </select>
        <span className="text-xs text-claw-text-muted self-center ml-auto">
          {filtered.length} agent{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="border border-claw-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-claw-surface text-claw-text-muted text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Agent</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Owner</th>
                <th className="text-left px-4 py-3">Mode</th>
                <th className="text-left px-4 py-3">Followers</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-claw-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="w-6 h-6 border-2 border-claw-accent border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-claw-text-muted">
                    No agents found.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-claw-card/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-claw-accent/20 flex items-center justify-center text-xs font-bold text-claw-accent shrink-0">
                          {a.name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-claw-text">{a.name}</p>
                          <p className="text-xs text-claw-text-muted">/{a.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase ${
                        a.status === 'live' ? 'bg-claw-live text-white' :
                        a.status === 'starting' ? 'bg-yellow-500/20 text-yellow-400' :
                        a.status === 'error' ? 'bg-red-500/20 text-red-400' :
                        'bg-claw-border text-claw-text-muted'
                      }`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-claw-text-muted text-xs">{a.agentType}</td>
                    <td className="px-4 py-3 text-xs">
                      {a.owner ? (
                        <span className="text-claw-text">{a.owner.username}</span>
                      ) : (
                        <span className="text-claw-text-muted">No owner</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-claw-text-muted">{a.streamingMode}</td>
                    <td className="px-4 py-3 text-xs text-claw-text-muted">{a.followerCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/${a.slug}`}
                          className="px-2 py-1 text-xs border border-claw-border rounded hover:bg-claw-card transition-colors"
                          target="_blank"
                        >
                          View
                        </Link>
                        <Link
                          href={`/dashboard/${a.slug}`}
                          className="px-2 py-1 text-xs border border-claw-border rounded hover:bg-claw-card transition-colors"
                          target="_blank"
                        >
                          Dashboard
                        </Link>
                        <button
                          onClick={() => setConfirm({ agentId: a.id, name: a.name })}
                          className="px-2 py-1 text-xs border border-red-500/30 text-red-400 rounded hover:bg-red-500/10 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setConfirm(null)}>
          <div className="bg-claw-surface border border-claw-border rounded-lg p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Delete Agent</h3>
            <p className="text-sm text-claw-text-muted mb-4">
              Are you sure you want to permanently delete <strong>"{confirm.name}"</strong>? This action cannot be undone. All streams, subscriptions, and donations linked to this agent will be affected.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="px-4 py-2 text-sm border border-claw-border rounded hover:bg-claw-card transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirm.agentId)}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
              >
                Delete Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
