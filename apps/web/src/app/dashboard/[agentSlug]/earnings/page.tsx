'use client';

/**
 * Earnings dashboard page for a creator's agent.
 *
 * Usage: /dashboard/[agentSlug]/earnings
 *
 * Sections:
 *  1. Stripe Connect onboarding / status card
 *  2. Earnings summary grid (4 cards) — shown only when connected
 *  3. Recent transfers table — shown only when connected
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StripeStatus {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

interface Transfer {
  id: string;
  createdAt: string;
  sourceType: 'donation' | 'subscription';
  grossAmount: number;
  platformFee: number;
  creatorAmount: number;
  status: 'completed' | 'pending' | 'failed';
}

interface EarningsSummary {
  totalGross: number;
  totalFees: number;
  totalNet: number;
  pendingAmount: number;
  recentTransfers: Transfer[];
}

// ---------------------------------------------------------------------------
// Helper sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  icon,
  valueClassName = 'text-gray-900',
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        {icon}
      </div>
      <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
    </div>
  );
}

function SourceBadge({ source }: { source: 'donation' | 'subscription' }) {
  if (source === 'donation') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
        Donation
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
      Subscription
    </span>
  );
}

function StatusPill({ status }: { status: 'completed' | 'pending' | 'failed' }) {
  const styles: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    failed: 'bg-red-100 text-red-700',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] ?? styles.pending}`}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function EarningsPage() {
  const { user, isLoggedIn, setShowLoginModal } = useUser();
  const params = useParams();
  const agentSlug = params?.agentSlug as string;

  const [agentId, setAgentId] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);

  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingOnboard, setLoadingOnboard] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Initial data fetch
  // ---------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    if (!isLoggedIn || !agentSlug) return;
    setLoadingPage(true);
    setError(null);
    try {
      // 1. Resolve agent ID from slug (private endpoint for owners)
      const agent = await api<{ id: string }>(`/agents/${agentSlug}/private`);
      setAgentId(agent.id);

      // 2. Stripe connect status
      const status = await api<StripeStatus>('/stripe/connect/status');
      setStripeStatus(status);

      // 3. Earnings summary — only fetch when fully connected
      if (status.connected && status.chargesEnabled) {
        const summary = await api<EarningsSummary>(
          `/stripe/connect/earnings?agentId=${agent.id}`,
        );
        setEarnings(summary);
      }
    } catch (err: any) {
      if (err.status === 403) {
        setError('You do not have access to this agent.');
      } else {
        setError(err.message || 'Failed to load earnings data.');
      }
    } finally {
      setLoadingPage(false);
    }
  }, [isLoggedIn, agentSlug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // Stripe actions
  // ---------------------------------------------------------------------------

  async function handleConnectStripe() {
    setLoadingOnboard(true);
    try {
      const res = await api<{ url: string }>('/stripe/connect/onboard', { method: 'POST' });
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start Stripe onboarding.');
    } finally {
      setLoadingOnboard(false);
    }
  }

  async function handleOpenDashboard() {
    setLoadingDashboard(true);
    try {
      const res = await api<{ url: string }>('/stripe/connect/dashboard-link', { method: 'POST' });
      if (res.url) {
        window.open(res.url, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to open Stripe dashboard.');
    } finally {
      setLoadingDashboard(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Auth guard
  // ---------------------------------------------------------------------------

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Log in to view earnings.</p>
          <button
            onClick={() => setShowLoginModal(true)}
            className="px-6 py-2 bg-orange-500 text-white rounded font-semibold hover:bg-orange-600 transition-colors"
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loadingPage) {
    return (
      <div className="flex items-center justify-center h-full p-6" aria-live="polite" aria-busy="true">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"
            role="status"
            aria-label="Loading earnings"
          />
          <span className="text-sm text-gray-500">Loading...</span>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error && !stripeStatus) {
    return (
      <div className="flex items-center justify-center h-full p-6" role="alert">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const isFullyConnected =
    stripeStatus?.connected && stripeStatus?.chargesEnabled && stripeStatus?.detailsSubmitted;
  const isPartiallyOnboarded =
    stripeStatus?.connected && (!stripeStatus?.chargesEnabled || !stripeStatus?.detailsSubmitted);

  const transfers = earnings?.recentTransfers ?? [];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <main className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track revenue from donations and subscriptions.
        </p>
      </div>

      {/* Inline error (non-fatal) */}
      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 1. Stripe Connect Section                                           */}
      {/* ------------------------------------------------------------------ */}
      <section aria-labelledby="stripe-section-title">
        {/* Not connected at all */}
        {!stripeStatus?.connected && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                {/* Stripe icon placeholder */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-orange-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 id="stripe-section-title" className="text-base font-semibold text-gray-900">
                    Start Earning
                  </h2>
                  <p className="text-sm text-gray-500 mt-1 max-w-md">
                    Connect your Stripe account to receive payouts from donations and subscriptions.
                    LiveClaw takes a 20% platform fee.
                  </p>
                </div>
              </div>
              <button
                onClick={handleConnectStripe}
                disabled={loadingOnboard}
                aria-busy={loadingOnboard}
                className="flex-shrink-0 px-5 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              >
                {loadingOnboard ? 'Redirecting...' : 'Connect with Stripe'}
              </button>
            </div>
          </div>
        )}

        {/* Connected but not fully onboarded */}
        {isPartiallyOnboarded && (
          <div className="bg-white border border-yellow-300 rounded-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-yellow-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 id="stripe-section-title" className="text-base font-semibold text-gray-900">
                    Stripe Setup Incomplete
                  </h2>
                  <p className="text-sm text-gray-500 mt-1 max-w-md">
                    Your Stripe account is connected but requires additional information before you
                    can receive payouts.
                  </p>
                </div>
              </div>
              <button
                onClick={handleConnectStripe}
                disabled={loadingOnboard}
                aria-busy={loadingOnboard}
                className="flex-shrink-0 px-5 py-2.5 bg-yellow-500 text-white text-sm font-semibold rounded-lg hover:bg-yellow-600 disabled:opacity-60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
              >
                {loadingOnboard ? 'Redirecting...' : 'Complete Stripe Setup'}
              </button>
            </div>
          </div>
        )}

        {/* Fully connected */}
        {isFullyConnected && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 id="stripe-section-title" className="text-base font-semibold text-gray-900">
                      Stripe Account
                    </h2>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      Connected
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Payouts are enabled. Manage your account from the Stripe dashboard.
                  </p>
                </div>
              </div>
              <button
                onClick={handleOpenDashboard}
                disabled={loadingDashboard}
                aria-busy={loadingDashboard}
                className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
              >
                {loadingDashboard ? (
                  'Opening...'
                ) : (
                  <>
                    Open Stripe Dashboard
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Earnings Summary Cards (connected only)                          */}
      {/* ------------------------------------------------------------------ */}
      {isFullyConnected && (
        <section aria-labelledby="summary-title">
          <h2 id="summary-title" className="text-base font-semibold text-gray-900 mb-4">
            Earnings Summary
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Earned */}
            <SummaryCard
              label="Total Earned"
              value={formatCurrency(earnings?.totalGross ?? 0)}
              valueClassName="text-gray-900"
              icon={
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-gray-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              }
            />

            {/* Platform Fees */}
            <SummaryCard
              label="Platform Fees (20%)"
              value={formatCurrency(earnings?.totalFees ?? 0)}
              valueClassName="text-red-600"
              icon={
                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-red-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              }
            />

            {/* Net Earnings */}
            <SummaryCard
              label="Net Earnings"
              value={formatCurrency(earnings?.totalNet ?? 0)}
              valueClassName="text-green-600"
              icon={
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                </div>
              }
            />

            {/* Pending */}
            <SummaryCard
              label="Pending"
              value={formatCurrency(earnings?.pendingAmount ?? 0)}
              valueClassName="text-yellow-600"
              icon={
                <div className="w-8 h-8 rounded-full bg-yellow-50 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-yellow-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              }
            />
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. Recent Transfers Table (connected only)                          */}
      {/* ------------------------------------------------------------------ */}
      {isFullyConnected && (
        <section aria-labelledby="transfers-title">
          <h2 id="transfers-title" className="text-base font-semibold text-gray-900 mb-4">
            Recent Transfers
          </h2>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {transfers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                <svg
                  className="w-10 h-10 mb-3 opacity-40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <p className="text-sm">No transfers yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full" aria-label="Recent transfers">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                      >
                        Date
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                      >
                        Source
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                      >
                        Gross
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                      >
                        Fee
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                      >
                        Net
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {transfers.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {new Date(t.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <SourceBadge source={t.sourceType} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap font-mono">
                          {formatCurrency(t.grossAmount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-red-500 text-right whitespace-nowrap font-mono">
                          -{formatCurrency(t.platformFee)}
                        </td>
                        <td className="px-4 py-3 text-sm text-green-600 text-right whitespace-nowrap font-mono font-medium">
                          {formatCurrency(t.creatorAmount)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusPill status={t.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
