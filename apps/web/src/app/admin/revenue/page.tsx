'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type Tab = 'donations' | 'subscriptions';

interface Donation {
  id: string;
  amount: number;
  amountUsd: number | null;
  token: string;
  txHash: string | null;
  status: string;
  type: 'donation' | 'subscription';
  message: string | null;
  createdAt: string;
  viewerUser?: { id: string; username: string };
  agent?: { id: string; slug: string; name: string };
}

interface Subscription {
  id: string;
  tier: string;
  isActive: boolean;
  startedAt: string;
  expiresAt: string;
  canceledAt: string | null;
  createdAt: string;
  user?: { id: string; username: string };
  agent?: { id: string; slug: string; name: string };
}

interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const TIER_LABELS: Record<string, string> = {
  tier_1: 'Tier 1 ($4.99)',
  tier_2: 'Tier 2 ($9.99)',
  tier_3: 'Tier 3 ($24.99)',
};

export default function AdminRevenuePage() {
  const [tab, setTab] = useState<Tab>('donations');

  // Donations state
  const [donations, setDonations] = useState<Donation[]>([]);
  const [donMeta, setDonMeta] = useState<PageMeta>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [donPage, setDonPage] = useState(1);
  const [donSort, setDonSort] = useState('');
  const [donLoading, setDonLoading] = useState(true);

  // Subscriptions state
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [subMeta, setSubMeta] = useState<PageMeta>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [subPage, setSubPage] = useState(1);
  const [subActive, setSubActive] = useState('');
  const [subTier, setSubTier] = useState('');
  const [subSort, setSubSort] = useState('');
  const [subLoading, setSubLoading] = useState(true);

  // Revenue summary
  const [stats, setStats] = useState<{ totalDonations: number; donationCount: number; totalMrr: number; activeSubscriptions: number } | null>(null);

  useEffect(() => {
    api('/admin/stats').then((s: any) => setStats(s.revenue)).catch(() => {});
  }, []);

  const fetchDonations = useCallback(async () => {
    setDonLoading(true);
    try {
      const params = new URLSearchParams({ page: String(donPage), limit: '20' });
      if (donSort) params.set('sort', donSort);
      const result = await api<{ data: Donation[]; meta: PageMeta }>(`/admin/donations?${params}`);
      setDonations(result.data);
      setDonMeta(result.meta);
    } catch {
      toast.error('Failed to load donations');
    } finally {
      setDonLoading(false);
    }
  }, [donPage, donSort]);

  const fetchSubs = useCallback(async () => {
    setSubLoading(true);
    try {
      const params = new URLSearchParams({ page: String(subPage), limit: '20' });
      if (subActive) params.set('active', subActive);
      if (subTier) params.set('tier', subTier);
      if (subSort) params.set('sort', subSort);
      const result = await api<{ data: Subscription[]; meta: PageMeta }>(`/admin/subscriptions?${params}`);
      setSubs(result.data);
      setSubMeta(result.meta);
    } catch {
      toast.error('Failed to load subscriptions');
    } finally {
      setSubLoading(false);
    }
  }, [subPage, subActive, subTier, subSort]);

  useEffect(() => { fetchDonations(); }, [fetchDonations]);
  useEffect(() => { fetchSubs(); }, [fetchSubs]);
  useEffect(() => { setDonPage(1); }, [donSort]);
  useEffect(() => { setSubPage(1); }, [subActive, subTier, subSort]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Revenue</h1>

      {/* Summary cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-claw-card border border-claw-border rounded-lg p-4">
            <p className="text-xs text-claw-text-muted uppercase tracking-wider mb-1">Total Donations</p>
            <p className="text-2xl font-bold">${stats.totalDonations.toFixed(2)}</p>
            <p className="text-xs text-claw-text-muted">{stats.donationCount} donations</p>
          </div>
          <div className="bg-claw-card border border-claw-border rounded-lg p-4">
            <p className="text-xs text-claw-text-muted uppercase tracking-wider mb-1">MRR</p>
            <p className="text-2xl font-bold">${stats.totalMrr.toFixed(2)}</p>
            <p className="text-xs text-claw-text-muted">{stats.activeSubscriptions} active subs</p>
          </div>
          <div className="bg-claw-card border border-claw-border rounded-lg p-4">
            <p className="text-xs text-claw-text-muted uppercase tracking-wider mb-1">Avg Donation</p>
            <p className="text-2xl font-bold">${stats.donationCount > 0 ? (stats.totalDonations / stats.donationCount).toFixed(2) : '0.00'}</p>
          </div>
          <div className="bg-claw-card border border-claw-border rounded-lg p-4">
            <p className="text-xs text-claw-text-muted uppercase tracking-wider mb-1">ARR (est.)</p>
            <p className="text-2xl font-bold">${(stats.totalMrr * 12).toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 mb-4 border-b border-claw-border">
        <button
          onClick={() => setTab('donations')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'donations' ? 'border-claw-accent text-claw-accent' : 'border-transparent text-claw-text-muted hover:text-claw-text'
          }`}
        >
          Donations ({donMeta.total})
        </button>
      </div>

      {/* Donations tab */}
      {tab === 'donations' && (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <select
              value={donSort}
              onChange={(e) => setDonSort(e.target.value)}
              className="bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
            >
              <option value="">Newest first</option>
              <option value="amount">Highest amount</option>
            </select>
          </div>

          <div className="border border-claw-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-claw-surface text-claw-text-muted text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3">User</th>
                    <th className="text-left px-4 py-3">Agent</th>
                    <th className="text-left px-4 py-3">Amount</th>
                    <th className="text-left px-4 py-3">Type</th>
                    <th className="text-left px-4 py-3">Tx</th>
                    <th className="text-left px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-claw-border">
                  {donLoading ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center"><div className="w-6 h-6 border-2 border-claw-accent border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
                  ) : donations.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-claw-text-muted">No donations found.</td></tr>
                  ) : (
                    donations.map((d) => (
                      <tr key={d.id} className="hover:bg-claw-card/50 transition-colors">
                        <td className="px-4 py-3 text-xs">
                          <span className="text-claw-text font-medium">{d.viewerUser?.username || 'Unknown'}</span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="text-claw-accent">{d.agent?.name || 'Unknown'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold text-green-400">${d.amountUsd ? Number(d.amountUsd).toFixed(2) : '—'}</span>
                          <span className="text-xs text-claw-text-muted ml-1">{d.token}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            d.type === 'subscription' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {d.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-claw-text-muted">
                          {d.txHash ? (
                            <a href={`https://basescan.org/tx/${d.txHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                              {d.txHash.slice(0, 8)}...
                            </a>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-claw-text-muted">
                          {new Date(d.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {donMeta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-claw-text-muted">Page {donMeta.page} of {donMeta.totalPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setDonPage((p) => Math.max(1, p - 1))} disabled={donPage <= 1} className="px-3 py-1 text-xs border border-claw-border rounded hover:bg-claw-card disabled:opacity-40 transition-colors">Previous</button>
                <button onClick={() => setDonPage((p) => Math.min(donMeta.totalPages, p + 1))} disabled={donPage >= donMeta.totalPages} className="px-3 py-1 text-xs border border-claw-border rounded hover:bg-claw-card disabled:opacity-40 transition-colors">Next</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Subscriptions tab */}
      {tab === 'subscriptions' && (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <select
              value={subActive}
              onChange={(e) => setSubActive(e.target.value)}
              className="bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <select
              value={subTier}
              onChange={(e) => setSubTier(e.target.value)}
              className="bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
            >
              <option value="">All tiers</option>
              <option value="tier_1">Tier 1</option>
              <option value="tier_2">Tier 2</option>
              <option value="tier_3">Tier 3</option>
            </select>
            <select
              value={subSort}
              onChange={(e) => setSubSort(e.target.value)}
              className="bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
            >
              <option value="">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          <div className="border border-claw-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-claw-surface text-claw-text-muted text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3">User</th>
                    <th className="text-left px-4 py-3">Agent</th>
                    <th className="text-left px-4 py-3">Tier</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Started</th>
                    <th className="text-left px-4 py-3">Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-claw-border">
                  {subLoading ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center"><div className="w-6 h-6 border-2 border-claw-accent border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
                  ) : subs.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-claw-text-muted">No subscriptions found.</td></tr>
                  ) : (
                    subs.map((s) => (
                      <tr key={s.id} className="hover:bg-claw-card/50 transition-colors">
                        <td className="px-4 py-3 text-xs">
                          <span className="text-claw-text font-medium">{s.user?.username || 'Unknown'}</span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="text-claw-accent">{s.agent?.name || 'Unknown'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            s.tier === 'tier_3' ? 'bg-yellow-500/20 text-yellow-400' :
                            s.tier === 'tier_2' ? 'bg-claw-accent/20 text-claw-accent' :
                            'bg-claw-border text-claw-text-muted'
                          }`}>
                            {TIER_LABELS[s.tier] || s.tier}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {s.isActive ? (
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">Active</span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">Inactive</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-claw-text-muted">
                          {new Date(s.startedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-claw-text-muted">
                          {s.expiresAt ? new Date(s.expiresAt).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {subMeta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-claw-text-muted">Page {subMeta.page} of {subMeta.totalPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setSubPage((p) => Math.max(1, p - 1))} disabled={subPage <= 1} className="px-3 py-1 text-xs border border-claw-border rounded hover:bg-claw-card disabled:opacity-40 transition-colors">Previous</button>
                <button onClick={() => setSubPage((p) => Math.min(subMeta.totalPages, p + 1))} disabled={subPage >= subMeta.totalPages} className="px-3 py-1 text-xs border border-claw-border rounded hover:bg-claw-card disabled:opacity-40 transition-colors">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
