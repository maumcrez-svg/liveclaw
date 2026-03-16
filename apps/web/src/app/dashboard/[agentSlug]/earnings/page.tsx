'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

interface CryptoSummary {
  totalConfirmed: number;
  totalPending: number;
  count: number;
  recentDonations: any[];
}

interface SubStats {
  activeCount: number;
  mrr: number;
  recent: any[];
}

export default function EarningsPage({ params }: { params: { agentSlug: string } }) {
  const { isLoggedIn, setShowLoginModal } = useUser();
  const [agent, setAgent] = useState<any>(null);
  const [cryptoSummary, setCryptoSummary] = useState<CryptoSummary | null>(null);
  const [subStats, setSubStats] = useState<SubStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    async function load() {
      try {
        const agentData = await api(`/agents/${params.agentSlug}/private`);
        setAgent(agentData);
        const [crypto, subs] = await Promise.all([
          api(`/crypto/donations/agent/${agentData.id}/summary`).catch(() => null),
          api(`/subscriptions/agent/${agentData.id}/stats`).catch(() => null),
        ]);
        setCryptoSummary(crypto);
        setSubStats(subs);
      } catch (err: any) {
        setError(err.status === 403 ? 'You do not have access to this agent.' : 'Failed to load earnings.');
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
          <p className="text-claw-text-muted mb-4">Log in to access earnings.</p>
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

  const totalCrypto = (cryptoSummary?.totalConfirmed || 0) + (cryptoSummary?.totalPending || 0);
  const totalRevenue = totalCrypto + (subStats?.mrr || 0);

  const allDonations = (cryptoSummary?.recentDonations || []).map((d: any) => ({
    id: d.id,
    username: d.viewerUser?.username || 'Anonymous',
    amount: d.amountUsd || d.amount,
    message: d.message,
    date: d.createdAt,
    status: d.status,
    network: d.network,
    token: d.token,
    txHash: d.txHash,
  }));

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Earnings</h1>

      {/* Revenue summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <SummaryCard
          label="Total Revenue"
          value={formatCurrency(totalRevenue)}
          accent
        />
        <SummaryCard
          label="Crypto Donations"
          value={formatCurrency(totalCrypto)}
          subtitle={cryptoSummary ? `${cryptoSummary.count} confirmed` : undefined}
        />
        <SummaryCard
          label="Subscriptions (MRR)"
          value={formatCurrency(subStats?.mrr || 0)}
          subtitle={subStats ? `${subStats.activeCount} active` : undefined}
        />
        <SummaryCard
          label="Pending"
          value={formatCurrency(cryptoSummary?.totalPending || 0)}
          subtitle="Awaiting confirmation"
        />
      </div>

      {/* Subscriptions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Active Subscribers</h2>
        {(subStats?.recent?.length || 0) > 0 ? (
          <div className="bg-claw-card border border-claw-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-claw-border text-left text-claw-text-muted">
                  <th className="px-4 py-2 font-medium">User</th>
                  <th className="px-4 py-2 font-medium">Tier</th>
                  <th className="px-4 py-2 font-medium">Price</th>
                  <th className="px-4 py-2 font-medium">Since</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {subStats!.recent.slice(0, 20).map((s: any) => (
                  <tr key={s.id} className="border-b border-claw-border/50 last:border-0">
                    <td className="px-4 py-2 font-medium">{s.user?.username || 'Unknown'}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 bg-claw-accent/10 text-claw-accent text-xs rounded font-medium uppercase">
                        {s.tier?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2">{formatCurrency(tierPrice(s.tier))}/mo</td>
                    <td className="px-4 py-2 text-claw-text-muted">{formatDate(s.startedAt || s.createdAt)}</td>
                    <td className="px-4 py-2">
                      {s.isActive ? (
                        <span className="text-green-400 text-xs font-medium">Active</span>
                      ) : (
                        <span className="text-claw-text-muted text-xs">Canceled</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="No subscribers yet" />
        )}
      </div>

      {/* All Donations */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Donation History</h2>
        {allDonations.length > 0 ? (
          <div className="space-y-2">
            {allDonations.slice(0, 30).map((d) => (
              <div key={d.id} className="bg-claw-card border border-claw-border rounded-lg p-3 flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-blue-600/20 text-blue-400">
                  E
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {d.username} donated {formatCurrency(d.amount)}
                    </p>
                    <StatusPill status={d.status} />
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-600/10 text-blue-400 rounded font-medium uppercase">
                      {d.network}/{d.token}
                    </span>
                  </div>
                  {d.message && <p className="text-xs text-claw-text-muted truncate mt-0.5">{d.message}</p>}
                </div>
                <span className="text-xs text-claw-text-muted flex-shrink-0">{formatDate(d.date)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="No donations yet" />
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, subtitle, accent }: { label: string; value: string; subtitle?: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg p-4 border ${accent ? 'bg-claw-accent/5 border-claw-accent/20' : 'bg-claw-card border-claw-border'}`}>
      <p className="text-xs text-claw-text-muted uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-claw-accent' : ''}`}>{value}</p>
      {subtitle && <p className="text-xs text-claw-text-muted mt-1">{subtitle}</p>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    confirmed: 'bg-green-600/20 text-green-400',
    pending: 'bg-yellow-600/20 text-yellow-400',
    confirming: 'bg-blue-600/20 text-blue-400',
    failed: 'bg-red-600/20 text-red-400',
    expired: 'bg-claw-card text-claw-text-muted',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${colors[status] || colors.confirmed}`}>
      {status}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-8 text-claw-text-muted bg-claw-card border border-claw-border rounded-lg">
      <p className="text-sm">{text}</p>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function tierPrice(tier: string): number {
  const prices: Record<string, number> = { tier_1: 4.99, tier_2: 9.99, tier_3: 24.99 };
  return prices[tier] || 0;
}
