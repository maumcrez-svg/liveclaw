'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api';

const TIERS = [
  { id: 'tier_1', name: 'Tier 1', price: 0.002, color: 'text-blue-400', icon: '\u2605' },
  { id: 'tier_2', name: 'Tier 2', price: 0.005, color: 'text-purple-400', icon: '\u2605\u2605' },
  { id: 'tier_3', name: 'Tier 3', price: 0.01, color: 'text-yellow-400', icon: '\u2666' },
];

interface SubscribeButtonProps {
  agentId: string;
  agentName: string;
}

type ModalStep = 'tiers' | 'pay' | 'tx' | 'success';

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-all ${
        copied
          ? 'bg-green-500/15 border-green-500/40 text-green-400'
          : 'bg-claw-card border-claw-border text-claw-text-muted hover:border-claw-accent'
      }`}
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}

export function SubscribeButton({ agentId, agentName }: SubscribeButtonProps) {
  const { user, isLoggedIn, setShowLoginModal } = useUser();
  const [currentTier, setCurrentTier] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<ModalStep>('tiers');

  // Payment state
  const [paymentId, setPaymentId] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [ethAmount, setEthAmount] = useState(0);
  const [selectedTier, setSelectedTier] = useState('');
  const [txHash, setTxHash] = useState('');

  useEffect(() => {
    if (!user) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/subscriptions/check?userId=${user.id}&agentId=${agentId}`, {
      headers: { Authorization: `Bearer ${(user as any).token}` },
    })
      .then((r) => r.json())
      .then((data) => setCurrentTier(data?.tier || null))
      .catch(() => {});
  }, [user, agentId]);

  const initiateSubscription = useCallback(async (tier: string) => {
    if (!user) return;
    setLoading(true);
    setSelectedTier(tier);
    try {
      const data = await api<{
        paymentId: string;
        recipientAddress: string;
        ethAmount: number;
        ethPrice: number;
        tier: string;
        expiresAt: string;
      }>('/subscriptions/initiate', {
        method: 'POST',
        body: JSON.stringify({ agentId, tier }),
      });
      setPaymentId(data.paymentId);
      setRecipientAddress(data.recipientAddress);
      setEthAmount(data.ethAmount);
      setStep('pay');
    } catch (err: any) {
      const msg = err?.body?.message || 'Failed to initiate subscription';
      toast.error(msg);
    }
    setLoading(false);
  }, [user, agentId]);

  const submitTx = useCallback(async () => {
    if (!txHash.trim()) return;
    setLoading(true);
    try {
      await api(`/subscriptions/${paymentId}/tx`, {
        method: 'PATCH',
        body: JSON.stringify({ txHash: txHash.trim() }),
      });
      setStep('success');
      toast.success('Subscription payment submitted!');
    } catch {
      toast.error('Failed to submit transaction');
    }
    setLoading(false);
  }, [txHash, paymentId]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      await api(`/subscriptions/${agentId}`, { method: 'DELETE' });
      setCurrentTier(null);
      closeModal();
      toast('Unsubscribed');
    } catch {
      toast.error('Failed to unsubscribe');
    }
    setLoading(false);
  }, [user, agentId]);

  const closeModal = () => {
    setShowModal(false);
    setStep('tiers');
    setTxHash('');
    setPaymentId('');
  };

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="bg-claw-surface border border-claw-border rounded-xl p-6 w-[420px] shadow-2xl shadow-black/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold">Subscribe to {agentName}</h2>
                <p className="text-xs text-claw-text-muted">
                  {step === 'tiers' && 'Pay with ETH on Base'}
                  {step === 'pay' && 'Send ETH to subscribe'}
                  {step === 'tx' && 'Paste your transaction hash'}
                  {step === 'success' && 'Payment submitted!'}
                </p>
              </div>
            </div>

            {/* Step: Choose tier */}
            {step === 'tiers' && (
              <>
                <div className="space-y-2">
                  {TIERS.map((tier) => (
                    <button
                      key={tier.id}
                      onClick={() => initiateSubscription(tier.id)}
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
                      <span className="text-sm font-medium text-claw-text-muted">{tier.price} ETH/mo</span>
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 mt-5">
                  <button
                    onClick={closeModal}
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
              </>
            )}

            {/* Step: Pay — show address */}
            {step === 'pay' && (
              <div>
                <div className="bg-blue-500/8 border border-blue-500/20 rounded-lg p-4 mb-4">
                  <p className="text-sm text-claw-text font-medium mb-1">
                    Send {ethAmount.toFixed(6)} ETH
                  </p>
                  <p className="text-xs text-claw-text-muted mb-3">
                    Transfer to this address on the <strong className="text-blue-400">Base</strong> network:
                  </p>
                  <div className="flex items-center justify-between gap-2 bg-claw-bg rounded-lg px-3 py-2 border border-claw-border">
                    <code className="text-xs font-mono text-claw-text break-all">{recipientAddress}</code>
                    <CopyButton text={recipientAddress} />
                  </div>
                </div>

                <p className="text-xs text-claw-text-muted mb-4">
                  After sending, click below to enter your transaction hash.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep('tiers')}
                    className="flex-1 px-4 py-2.5 text-sm font-medium border border-claw-border rounded-lg hover:bg-claw-card transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep('tx')}
                    className="flex-1 px-4 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-500 transition-colors"
                  >
                    I've sent the ETH
                  </button>
                </div>
              </div>
            )}

            {/* Step: Paste tx hash */}
            {step === 'tx' && (
              <div>
                <label className="block text-xs font-medium text-claw-text-muted uppercase tracking-wide mb-1.5">
                  Transaction Hash
                </label>
                <input
                  type="text"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-claw-bg border border-claw-border rounded-lg px-3 py-2 text-sm font-mono text-claw-text placeholder:text-claw-text-muted focus:outline-none focus:border-purple-500 transition-colors mb-3"
                  spellCheck={false}
                />
                <p className="text-xs text-claw-text-muted mb-4">
                  Find your tx hash on{' '}
                  <a href={`https://basescan.org/address/${recipientAddress}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                    BaseScan
                  </a>
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep('pay')}
                    className="flex-1 px-4 py-2.5 text-sm font-medium border border-claw-border rounded-lg hover:bg-claw-card transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={submitTx}
                    disabled={loading || !txHash.trim()}
                    className="flex-1 px-4 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-500 disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Submitting...' : 'Confirm Subscription'}
                  </button>
                </div>
              </div>
            )}

            {/* Step: Success */}
            {step === 'success' && (
              <div className="py-2">
                <div className="flex flex-col items-center text-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <p className="text-base font-bold text-claw-text">Payment submitted!</p>
                  <p className="text-xs text-claw-text-muted">Your subscription will activate once the transaction is confirmed on-chain.</p>
                </div>
                <button
                  onClick={closeModal}
                  className="w-full px-4 py-2.5 text-sm border border-claw-border rounded-lg hover:bg-claw-card transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
