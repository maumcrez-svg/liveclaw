'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface HealthData {
  status: string;
  db: string;
  redis: string;
  mediamtx: string;
  containers: { running: number; names: string[] };
  uptime: string;
}

interface GlobalStats {
  users: { total: number; viewers: number; creators: number; admins: number; banned: number };
  agents: { total: number; live: number; offline: number };
  streams: { totalHistoric: number; currentlyLive: number };
  revenue: { totalDonations: number; donationCount: number; totalMrr: number; activeSubscriptions: number };
}

function formatUptime(raw: string): string {
  const seconds = parseInt(raw.replace('s', ''), 10);
  if (isNaN(seconds)) return raw;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

export default function AdminHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [h, s] = await Promise.all([
        fetch(`${API_URL}/health`).then((r) => r.json()).catch(() => null),
        api<GlobalStats>('/admin/stats').catch(() => null),
      ]);
      setHealth(h);
      setStats(s);
      setLastChecked(new Date());
    } catch {
      toast.error('Failed to load health data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-claw-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const containers = health?.containers || { running: -1, names: [] };
  const dockerOk = containers.running >= 0;

  const services = [
    {
      name: 'API Server',
      status: health ? 'ok' : 'error',
      detail: health ? `Uptime: ${formatUptime(health.uptime)}` : 'Unreachable',
    },
    {
      name: 'PostgreSQL',
      status: health?.db || 'unknown',
      detail: health?.db === 'ok' ? 'Connected' : health?.db === 'error' ? 'Connection failed' : 'Unknown',
    },
    {
      name: 'Redis',
      status: health?.redis || 'unknown',
      detail: health?.redis === 'ok' ? 'Connected (chat pub/sub)' : health?.redis === 'error' ? 'Connection failed' : 'Unknown',
    },
    {
      name: 'MediaMTX',
      status: health?.mediamtx || 'unknown',
      detail: health?.mediamtx === 'ok' ? 'Running (RTMP/HLS)' : health?.mediamtx === 'error' ? 'Unreachable' : 'Unknown',
    },
    {
      name: 'Docker Runtime',
      status: dockerOk ? 'ok' : 'error',
      detail: dockerOk
        ? `${containers.running} container${containers.running !== 1 ? 's' : ''} running`
        : 'Docker socket unavailable',
    },
  ];

  const statusColor = (s: string) => {
    if (s === 'ok') return 'bg-green-500';
    if (s === 'error') return 'bg-red-500';
    return 'bg-gray-500';
  };

  const statusLabel = (s: string) => {
    if (s === 'ok') return 'Healthy';
    if (s === 'error') return 'Error';
    return 'Unknown';
  };

  const coreOk = health && health.db === 'ok' && health.redis === 'ok';
  const overallStatus = !health ? 'error' : coreOk ? 'ok' : 'degraded';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">System Health</h1>
        <div className="flex items-center gap-3">
          {lastChecked && (
            <span className="text-xs text-claw-text-muted">
              Last check: {lastChecked.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchAll}
            className="px-3 py-1.5 text-xs border border-claw-border rounded hover:bg-claw-card transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Overall status */}
      <div className={`rounded-lg p-4 mb-6 border ${
        overallStatus === 'ok' ? 'bg-green-500/10 border-green-500/30' :
        overallStatus === 'degraded' ? 'bg-yellow-500/10 border-yellow-500/30' :
        'bg-red-500/10 border-red-500/30'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            overallStatus === 'ok' ? 'bg-green-500' :
            overallStatus === 'degraded' ? 'bg-yellow-500' :
            'bg-red-500'
          }`} />
          <span className="text-lg font-bold">
            {overallStatus === 'ok' ? 'All Systems Operational' :
             overallStatus === 'degraded' ? 'Degraded Performance' :
             'System Down'}
          </span>
        </div>
      </div>

      {/* Services grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {services.map((svc) => (
          <div key={svc.name} className="bg-claw-card border border-claw-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-claw-text">{svc.name}</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${statusColor(svc.status)}`} />
                <span className={`text-xs font-medium ${
                  svc.status === 'ok' ? 'text-green-400' :
                  svc.status === 'error' ? 'text-red-400' :
                  'text-claw-text-muted'
                }`}>
                  {statusLabel(svc.status)}
                </span>
              </div>
            </div>
            <p className="text-xs text-claw-text-muted">{svc.detail}</p>
          </div>
        ))}
      </div>

      {/* Running containers */}
      {dockerOk && containers.names.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4">Running Agent Containers</h2>
          <div className="bg-claw-card border border-claw-border rounded-lg overflow-hidden">
            <div className="divide-y divide-claw-border">
              {containers.names.map((name) => (
                <div key={name} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm font-mono text-claw-text">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Platform stats */}
      {stats && (
        <>
          <h2 className="text-lg font-bold mb-4">Platform Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            <StatCard label="Users" value={stats.users.total} />
            <StatCard label="Creators" value={stats.users.creators} />
            <StatCard label="Agents" value={stats.agents.total} />
            <StatCard label="Live Now" value={stats.streams.currentlyLive} highlight={stats.streams.currentlyLive > 0} />
            <StatCard label="Total Streams" value={stats.streams.totalHistoric} />
            <StatCard label="Active Subs" value={stats.revenue.activeSubscriptions} />
          </div>
        </>
      )}

      {/* Server info */}
      {health && (
        <div className="bg-claw-card border border-claw-border rounded-lg p-4">
          <h3 className="text-sm font-bold mb-3">Server Info</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-claw-text-muted uppercase tracking-wider mb-1">API Uptime</p>
              <p className="font-mono text-claw-text">{formatUptime(health.uptime)}</p>
            </div>
            <div>
              <p className="text-xs text-claw-text-muted uppercase tracking-wider mb-1">Database</p>
              <p className={`font-mono ${health.db === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                {health.db === 'ok' ? 'Connected' : 'Disconnected'}
              </p>
            </div>
            <div>
              <p className="text-xs text-claw-text-muted uppercase tracking-wider mb-1">Redis</p>
              <p className={`font-mono ${health.redis === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                {health.redis === 'ok' ? 'Connected' : 'Disconnected'}
              </p>
            </div>
            <div>
              <p className="text-xs text-claw-text-muted uppercase tracking-wider mb-1">MediaMTX</p>
              <p className={`font-mono ${health.mediamtx === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                {health.mediamtx === 'ok' ? 'Running' : 'Down'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="bg-claw-card border border-claw-border rounded-lg p-3 text-center">
      <p className="text-xs text-claw-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold ${highlight ? 'text-claw-live' : 'text-claw-text'}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
