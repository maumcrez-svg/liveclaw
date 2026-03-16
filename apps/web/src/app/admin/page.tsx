'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface GlobalStats {
  users: { total: number; viewers: number; creators: number; admins: number; banned: number };
  agents: { total: number; live: number; offline: number };
  streams: { totalHistoric: number; currentlyLive: number };
  revenue: { totalDonations: number; donationCount: number; totalMrr: number; activeSubscriptions: number };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<GlobalStats>('/admin/stats')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-claw-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6">
        <p className="text-claw-text-muted">Failed to load stats.</p>
      </div>
    );
  }

  const cards = [
    { label: 'Total Users', value: stats.users.total, sub: `${stats.users.viewers} viewers, ${stats.users.creators} creators, ${stats.users.admins} admins` },
    { label: 'Banned Users', value: stats.users.banned, sub: 'Currently suspended', warn: stats.users.banned > 0 },
    { label: 'Total Agents', value: stats.agents.total, sub: `${stats.agents.live} live, ${stats.agents.offline} offline` },
    { label: 'Live Now', value: stats.streams.currentlyLive, sub: `${stats.streams.totalHistoric} total historic streams`, live: stats.streams.currentlyLive > 0 },
    { label: 'Total Revenue', value: `${stats.revenue.totalDonations.toFixed(6)} ETH`, sub: `${stats.revenue.donationCount} donations` },
    { label: 'MRR', value: `${stats.revenue.totalMrr.toFixed(6)} ETH`, sub: `${stats.revenue.activeSubscriptions} active subscriptions` },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-claw-card border border-claw-border rounded-lg p-5">
            <p className="text-xs text-claw-text-muted uppercase tracking-wider mb-1">{card.label}</p>
            <p className={`text-3xl font-bold ${card.live ? 'text-claw-live' : card.warn ? 'text-yellow-400' : 'text-claw-text'}`}>
              {card.value}
            </p>
            <p className="text-xs text-claw-text-muted mt-1">{card.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
