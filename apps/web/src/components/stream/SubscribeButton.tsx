'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const TIERS = [
  { id: 'tier_1', name: 'Tier 1', price: '$4.99', color: 'text-blue-400', icon: '\u2605' },
  { id: 'tier_2', name: 'Tier 2', price: '$9.99', color: 'text-purple-400', icon: '\u2605\u2605' },
  { id: 'tier_3', name: 'Tier 3', price: '$24.99', color: 'text-yellow-400', icon: '\u2666' },
];

interface SubscribeButtonProps {
  agentId: string;
  agentName: string;
}

export function SubscribeButton({ agentId, agentName }: SubscribeButtonProps) {
  const { user, isLoggedIn, setShowLoginModal } = useUser();
  const [currentTier, setCurrentTier] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(`${API_URL}/subscriptions/check?userId=${user.id}&agentId=${agentId}`)
      .then((r) => r.json())
      .then((data) => setCurrentTier(data?.tier || null))
      .catch(() => {});
  }, [user, agentId]);

  const subscribe = useCallback(async (tier: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api<{ url: string }>('/subscriptions/checkout', {
        method: 'POST',
        body: JSON.stringify({ agentId, tier }),
      });
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error('Failed to create checkout session');
      }
    } catch (err: any) {
      const msg = err?.body?.message || 'Failed to subscribe';
      toast.error(msg);
    }
    setLoading(false);
  }, [user, agentId]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      await fetch(`${API_URL}/subscriptions/${user.id}/${agentId}`, { method: 'DELETE' });
      setCurrentTier(null);
      setShowModal(false);
      toast('Unsubscribed');
    } catch {
      toast.error('Failed to unsubscribe');
    }
    setLoading(false);
  }, [user, agentId]);

  const handleClick = () => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    setShowModal(true);
  };

  const tierInfo = currentTier ? TIERS.find((t) => t.id === currentTier) : null;

  return (
    <>
      <button
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
          currentTier
            ? 'bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30'
            : 'bg-purple-600 text-white hover:bg-purple-500 shadow-sm shadow-purple-900/30'
        }`}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill={currentTier ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        {tierInfo ? `${tierInfo.icon} Subscribed` : 'Subscribe'}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-claw-surface border border-claw-border rounded-xl p-6 w-[420px] shadow-2xl shadow-black/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold">Subscribe to {agentName}</h2>
                <p className="text-xs text-claw-text-muted">Choose a subscription tier</p>
              </div>
            </div>

            <div className="space-y-2">
              {TIERS.map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => subscribe(tier.id)}
                  disabled={loading}
                  className={`w-full flex items-center justify-between p-3.5 rounded-lg border transition-all ${
                    currentTier === tier.id
                      ? 'border-purple-500 bg-purple-600/10 shadow-sm shadow-purple-900/20'
                      : 'border-claw-border hover:border-claw-accent hover:bg-claw-card'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-lg ${tier.color}`}>{tier.icon}</span>
                    <div className="text-left">
                      <span className="font-semibold text-sm">{tier.name}</span>
                      {currentTier === tier.id && (
                        <span className="ml-2 text-[10px] text-purple-400 font-medium uppercase">Current</span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-medium text-claw-text-muted">{tier.price}/mo</span>
                </button>
              ))}
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium border border-claw-border rounded-lg hover:bg-claw-card transition-colors"
              >
                Cancel
              </button>
              {currentTier && (
                <button
                  onClick={unsubscribe}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-red-400 border border-red-800/50 rounded-lg hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  Unsubscribe
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
