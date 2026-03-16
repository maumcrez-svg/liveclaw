'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api';

const PRESET_AMOUNTS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1];

interface DonationFormProps {
  agentId: string;
  streamId: string;
  onClose: () => void;
}

type FormState = 'loading' | 'no-wallet' | 'ready' | 'submitted' | 'success';

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function BaseChainBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
      {/* Base chain circle logo */}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="12" fill="#0052FF" />
        <path
          d="M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zm0 13.125A5.625 5.625 0 1 1 12 6.375a5.625 5.625 0 0 1 0 11.25z"
          fill="#fff"
        />
      </svg>
      Base
    </span>
  );
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-all duration-200 ${
        copied
          ? 'bg-green-500/15 border-green-500/40 text-green-400'
          : 'bg-claw-card border-claw-border text-claw-text-muted hover:border-claw-accent hover:text-claw-accent'
      }`}
      aria-label={copied ? 'Copied!' : label}
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

export function DonationForm({ agentId, streamId, onClose }: DonationFormProps) {
  const { user } = useUser();

  const [formState, setFormState] = useState<FormState>('loading');
  const [walletAddress, setWalletAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [txHash, setTxHash] = useState('');
  const [donationId, setDonationId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [addressCopied, setAddressCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchWallet() {
      try {
        const data = await api<{ address: string }>(`/crypto/wallets/agent/${agentId}`);
        if (!cancelled) {
          setWalletAddress(data.address);
          setFormState('ready');
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const status = (err as { status?: number })?.status;
        if (status === 404) {
          setFormState('no-wallet');
        } else {
          toast.error('Failed to load creator wallet');
          setFormState('no-wallet');
        }
      }
    }

    fetchWallet();
    return () => { cancelled = true; };
  }, [agentId]);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setAddressCopied(true);
      toast.success('Wallet address copied!');
      setTimeout(() => setAddressCopied(false), 2500);
    } catch {
      toast.error('Failed to copy address');
    }
  };

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!num || num < 0.01) {
      setError('Enter a valid amount');
      return;
    }
    if (!user) {
      setError('You must be logged in to donate');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const data = await api<{ id: string }>('/crypto/donations/initiate', {
        method: 'POST',
        body: JSON.stringify({
          agentId,
          amount: num,
          network: 'base',
          token: 'ETH',
          message: message.trim(),
        }),
      });
      setDonationId(data.id);
      setFormState('submitted');
    } catch {
      toast.error('Failed to initiate donation');
      setError('Failed to initiate donation. Please try again.');
    }
    setSubmitting(false);
  };

  const handleSubmitTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txHash.trim()) {
      setError('Paste your transaction hash');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api(`/crypto/donations/${donationId}/tx`, {
        method: 'PATCH',
        body: JSON.stringify({ txHash: txHash.trim() }),
      });
      setFormState('success');
      toast.success('Donation submitted — thank you!');
    } catch {
      toast.error('Failed to record transaction');
      setError('Failed to record transaction hash. Please try again.');
    }
    setSubmitting(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Crypto donation"
    >
      <div className="bg-claw-surface border border-claw-border rounded-xl p-6 w-[400px] max-w-[calc(100vw-2rem)] shadow-xl">

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-bold text-claw-text">Send a Donation</h2>
              <BaseChainBadge />
            </div>
            <p className="text-xs text-claw-text-muted">Pay with ETH on Base network</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-claw-text-muted hover:text-claw-text transition-colors mt-0.5"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
            </svg>
          </button>
        </div>

        {/* Loading */}
        {formState === 'loading' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="w-8 h-8 border-2 border-claw-border border-t-blue-500 rounded-full animate-spin" aria-hidden="true" />
            <p className="text-sm text-claw-text-muted">Loading creator wallet…</p>
          </div>
        )}

        {/* No wallet */}
        {formState === 'no-wallet' && (
          <div className="py-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-claw-card border border-claw-border flex items-center justify-center" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-claw-text-muted">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                </svg>
              </div>
              <p className="text-sm text-claw-text-muted">This creator hasn't set up their wallet yet.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full px-4 py-2 text-sm border border-claw-border rounded-lg hover:bg-claw-card transition-colors text-claw-text"
            >
              Close
            </button>
          </div>
        )}

        {/* Ready — amount + address */}
        {formState === 'ready' && (
          <form onSubmit={handleInitiate} noValidate>
            {/* Preset amounts */}
            <p className="text-xs font-medium text-claw-text-muted uppercase tracking-wide mb-2">Amount (ETH)</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(String(preset))}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors font-medium ${
                    amount === String(preset)
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-claw-border hover:border-blue-500/60 text-claw-text-muted'
                  }`}
                >
                  {preset} ETH
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <div className="relative mb-4">
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(''); }}
                placeholder="Custom amount (ETH)"
                className="w-full bg-claw-bg border border-claw-border rounded-lg px-3 pr-14 py-2 text-sm text-claw-text placeholder:text-claw-text-muted focus:outline-none focus:border-blue-500 transition-colors"
                aria-label="Donation amount in ETH"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-claw-text-muted text-sm select-none">ETH</span>
            </div>

            {/* Message */}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a message (optional)"
              maxLength={200}
              rows={2}
              className="w-full bg-claw-bg border border-claw-border rounded-lg px-3 py-2 text-sm text-claw-text placeholder:text-claw-text-muted focus:outline-none focus:border-blue-500 transition-colors resize-none mb-4"
              aria-label="Donation message"
            />

            {/* Wallet address card */}
            <div className="bg-claw-card border border-claw-border rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-claw-text-muted uppercase tracking-wide">Creator wallet</span>
                <a
                  href={`https://basescan.org/address/${walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                  aria-label="View address on BaseScan"
                >
                  BaseScan
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1z" />
                  </svg>
                </a>
              </div>
              <div className="flex items-center justify-between gap-2">
                <code className="text-sm font-mono text-claw-text truncate" title={walletAddress}>
                  {truncateAddress(walletAddress)}
                </code>
                <CopyButton text={walletAddress} label="Copy" />
              </div>
            </div>

            {/* Prominent copy CTA */}
            <button
              type="button"
              onClick={handleCopyAddress}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all duration-200 mb-3 ${
                addressCopied
                  ? 'bg-green-500/10 border-green-500/40 text-green-400'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
              }`}
              aria-live="polite"
            >
              {addressCopied ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
                  </svg>
                  Address copied!
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
                    <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
                  </svg>
                  Copy Full Address
                </>
              )}
            </button>

            {error && (
              <p className="text-red-400 text-xs mb-3" role="alert">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm border border-claw-border rounded-lg hover:bg-claw-card transition-colors text-claw-text"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !amount}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Saving…' : `Continue with ${amount || '0'} ETH`}
              </button>
            </div>
          </form>
        )}

        {/* Submitted — paste tx hash */}
        {formState === 'submitted' && (
          <form onSubmit={handleSubmitTx} noValidate>
            <div className="bg-blue-500/8 border border-blue-500/20 rounded-lg p-4 mb-4">
              <p className="text-sm text-claw-text font-medium mb-1">Send your payment now</p>
              <p className="text-xs text-claw-text-muted mb-3">
                Transfer <strong className="text-claw-text">{amount} ETH</strong> to this address on the{' '}
                <strong className="text-blue-400">Base</strong> network:
              </p>
              <div className="flex items-center justify-between gap-2 bg-claw-bg rounded-lg px-3 py-2 border border-claw-border">
                <code className="text-xs font-mono text-claw-text break-all">{walletAddress}</code>
                <CopyButton text={walletAddress} label="Copy" />
              </div>
            </div>

            <label className="block text-xs font-medium text-claw-text-muted uppercase tracking-wide mb-1.5" htmlFor="txHash">
              Paste your transaction hash
            </label>
            <input
              id="txHash"
              type="text"
              value={txHash}
              onChange={(e) => { setTxHash(e.target.value); setError(''); }}
              placeholder="0x..."
              className="w-full bg-claw-bg border border-claw-border rounded-lg px-3 py-2 text-sm font-mono text-claw-text placeholder:text-claw-text-muted focus:outline-none focus:border-blue-500 transition-colors mb-3"
              aria-label="Transaction hash"
              spellCheck={false}
            />

            <p className="text-xs text-claw-text-muted mb-4">
              After sending, find your tx hash on{' '}
              <a
                href={`https://basescan.org/address/${walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                BaseScan
              </a>{' '}
              and paste it above.
            </p>

            {error && (
              <p className="text-red-400 text-xs mb-3" role="alert">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormState('ready')}
                className="flex-1 px-4 py-2 text-sm border border-claw-border rounded-lg hover:bg-claw-card transition-colors text-claw-text"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting || !txHash.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Confirming…' : 'Submit Donation'}
              </button>
            </div>
          </form>
        )}

        {/* Success */}
        {formState === 'success' && (
          <div className="py-2">
            <div className="flex flex-col items-center text-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <p className="text-base font-bold text-claw-text">Donation submitted!</p>
                <p className="text-xs text-claw-text-muted mt-0.5">Thank you for supporting this creator.</p>
              </div>
            </div>

            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-blue-500/30 bg-blue-500/8 text-blue-400 text-sm font-medium hover:bg-blue-500/15 transition-colors mb-3"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1z" />
              </svg>
              View transaction on BaseScan
            </a>

            <div className="flex items-center gap-2 bg-claw-card border border-claw-border rounded-lg px-3 py-2 mb-4">
              <code className="text-xs font-mono text-claw-text-muted truncate flex-1" title={txHash}>
                {truncateAddress(txHash)}
              </code>
              <CopyButton text={txHash} label="Copy tx" />
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2 text-sm border border-claw-border rounded-lg hover:bg-claw-card transition-colors text-claw-text"
            >
              Close
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
