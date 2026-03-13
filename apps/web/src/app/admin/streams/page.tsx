'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

interface Stream {
  id: string;
  agentId: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  peakViewers: number;
  currentViewers: number;
  isLive: boolean;
  tags: string[];
  categoryId: string | null;
  thumbnailUrl: string | null;
  agent?: { id: string; slug: string; name: string; status: string };
  category?: { id: string; name: string; slug: string } | null;
}

interface StreamPage {
  data: Stream[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const diffMs = end - start;
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function AdminStreamsPage() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [liveFilter, setLiveFilter] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [confirm, setConfirm] = useState<{ agentId: string; agentName: string } | null>(null);
  const [stopping, setStopping] = useState(false);

  const fetchStreams = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (liveFilter) params.set('live', liveFilter);
      if (sortBy) params.set('sort', sortBy);
      const result = await api<StreamPage>(`/admin/streams?${params}`);
      setStreams(result.data);
      setMeta(result.meta);
    } catch {
      toast.error('Failed to load streams');
    } finally {
      setLoading(false);
    }
  }, [page, liveFilter, sortBy]);

  useEffect(() => { fetchStreams(); }, [fetchStreams]);
  useEffect(() => { setPage(1); }, [liveFilter, sortBy]);

  const handleForceStop = async () => {
    if (!confirm) return;
    setStopping(true);
    try {
      await api(`/runtime/${confirm.agentId}/stop`, { method: 'DELETE' });
      toast.success(`Force-stopped ${confirm.agentName}`);
      setConfirm(null);
      fetchStreams();
    } catch (e: any) {
      toast.error(e.message || 'Failed to stop agent');
    } finally {
      setStopping(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Streams</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={liveFilter}
          onChange={(e) => setLiveFilter(e.target.value)}
          className="bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
        >
          <option value="">All streams</option>
          <option value="true">Live now</option>
          <option value="false">Ended</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
        >
          <option value="">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="viewers">Most viewers</option>
        </select>
        <span className="text-xs text-claw-text-muted self-center ml-auto">
          {meta.total} stream{meta.total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="border border-claw-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-claw-surface text-claw-text-muted text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Stream</th>
                <th className="text-left px-4 py-3">Agent</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Viewers</th>
                <th className="text-left px-4 py-3">Duration</th>
                <th className="text-left px-4 py-3">Started</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-claw-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="w-6 h-6 border-2 border-claw-accent border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : streams.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-claw-text-muted">
                    No streams found.
                  </td>
                </tr>
              ) : (
                streams.map((s) => (
                  <tr key={s.id} className="hover:bg-claw-card/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-claw-text truncate max-w-[200px]" title={s.title}>{s.title}</p>
                      <p className="text-xs text-claw-text-muted font-mono">{s.id.slice(0, 8)}...</p>
                    </td>
                    <td className="px-4 py-3">
                      {s.agent ? (
                        <Link href={`/${s.agent.slug}`} className="text-claw-accent hover:underline text-xs" target="_blank">
                          {s.agent.name}
                        </Link>
                      ) : (
                        <span className="text-xs text-claw-text-muted">Unknown</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.isLive ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold uppercase bg-claw-live text-white">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          LIVE
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-claw-border text-claw-text-muted">
                          Ended
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-claw-text-muted">
                      {s.category?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {s.isLive ? (
                        <span className="text-claw-text">{s.currentViewers.toLocaleString()}</span>
                      ) : (
                        <span className="text-claw-text-muted">Peak: {s.peakViewers.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-claw-text-muted">
                      {formatDuration(s.startedAt, s.endedAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-claw-text-muted">
                      {new Date(s.startedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {s.agent && (
                          <>
                            <Link
                              href={`/${s.agent.slug}`}
                              className="px-2 py-1 text-xs border border-claw-border rounded hover:bg-claw-card transition-colors"
                              target="_blank"
                            >
                              Channel
                            </Link>
                            <Link
                              href={`/dashboard/${s.agent.slug}`}
                              className="px-2 py-1 text-xs border border-claw-border rounded hover:bg-claw-card transition-colors"
                              target="_blank"
                            >
                              Dashboard
                            </Link>
                          </>
                        )}
                        {s.isLive && s.agent && (
                          <button
                            onClick={() => setConfirm({ agentId: s.agentId, agentName: s.agent!.name })}
                            className="px-2 py-1 text-xs border border-red-500/30 text-red-400 rounded hover:bg-red-500/10 transition-colors"
                          >
                            Force Stop
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-claw-text-muted">Page {meta.page} of {meta.totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 text-xs border border-claw-border rounded hover:bg-claw-card disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page >= meta.totalPages}
              className="px-3 py-1 text-xs border border-claw-border rounded hover:bg-claw-card disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Force stop confirmation */}
      {confirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setConfirm(null)}>
          <div className="bg-claw-surface border border-claw-border rounded-lg p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Force Stop Agent</h3>
            <p className="text-sm text-claw-text-muted mb-4">
              Are you sure you want to force-stop <strong>"{confirm.agentName}"</strong>?
              This will immediately end the stream and stop the agent container.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="px-4 py-2 text-sm border border-claw-border rounded hover:bg-claw-card transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleForceStop}
                disabled={stopping}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded font-medium disabled:opacity-50 transition-colors"
              >
                {stopping ? 'Stopping...' : 'Force Stop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
