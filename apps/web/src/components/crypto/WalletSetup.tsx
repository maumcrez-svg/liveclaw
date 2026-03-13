'use client';

// Usage:
// import { WalletSetup } from '@/components/crypto/WalletSetup';
// <WalletSetup agentId="abc123" />

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

type WalletState = 'loading' | 'no-wallet' | 'editing' | 'saved';

interface SavedWallet {
  id: string;
  network: string;
  address: string;
}

interface WalletSetupProps {
  agentId: string;
}

export function WalletSetup({ agentId }: WalletSetupProps) {
  const [state, setState] = useState<WalletState>('loading');
  const [savedWallet, setSavedWallet] = useState<SavedWallet | null>(null);

  // Editing fields
  const [address, setAddress] = useState('');
  const [confirmAddress, setConfirmAddress] = useState('');
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Derived validation
  const addressValid = EVM_ADDRESS_RE.test(address);
  const addressesMatch = address === confirmAddress && confirmAddress.length > 0;
  const canSave = addressValid && addressesMatch && disclaimerChecked;

  useEffect(() => {
    let cancelled = false;
    api<SavedWallet>(`/crypto/wallets/agent/${agentId}`)
      .then((wallet) => {
        if (cancelled) return;
        setSavedWallet(wallet);
        setState('saved');
      })
      .catch((err: any) => {
        if (cancelled) return;
        if (err?.status === 404) {
          setState('no-wallet');
        } else {
          // Treat unexpected errors as no-wallet to avoid blocking the page
          setState('no-wallet');
        }
      });
    return () => { cancelled = true; };
  }, [agentId]);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const wallet = await api<SavedWallet>(`/crypto/wallets/agent/${agentId}`, {
        method: 'PUT',
        body: JSON.stringify({ network: 'base', address }),
      });
      setSavedWallet(wallet);
      setState('saved');
      setAddress('');
      setConfirmAddress('');
      setDisclaimerChecked(false);
      toast.success('Donation wallet saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save wallet');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!savedWallet) return;
    setDeleting(true);
    try {
      await api(`/crypto/wallets/agent/${agentId}`, { method: 'DELETE' });
      setSavedWallet(null);
      setState('no-wallet');
      toast.success('Donation wallet removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove wallet');
    } finally {
      setDeleting(false);
    }
  };

  const handleCopy = () => {
    if (!savedWallet) return;
    navigator.clipboard.writeText(savedWallet.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error('Failed to copy address');
    });
  };

  const startEditing = () => {
    setAddress('');
    setConfirmAddress('');
    setDisclaimerChecked(false);
    setState('editing');
  };

  const cancelEditing = () => {
    setAddress('');
    setConfirmAddress('');
    setDisclaimerChecked(false);
    setState(savedWallet ? 'saved' : 'no-wallet');
  };

  // --- Loading ---
  if (state === 'loading') {
    return (
      <div className="flex items-center gap-2 text-claw-text-muted text-sm py-4">
        <div className="w-4 h-4 border-2 border-claw-accent border-t-transparent rounded-full animate-spin" />
        <span>Loading wallet info...</span>
      </div>
    );
  }

  // --- Saved state ---
  if (state === 'saved' && savedWallet) {
    return (
      <div className="bg-claw-card border border-claw-border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-claw-surface border border-claw-border text-claw-text-muted uppercase tracking-wide">
            Base
          </span>
          <span className="text-xs text-claw-text-muted">Ethereum L2</span>
        </div>

        <div>
          <p className="text-sm font-mono text-claw-text" title={savedWallet.address}>
            {truncateAddress(savedWallet.address)}
          </p>
          <p className="text-xs text-claw-text-muted mt-0.5 font-mono break-all">
            {savedWallet.address}
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-medium rounded border border-claw-border text-claw-text hover:bg-claw-surface transition-colors"
          >
            {copied ? 'Copied!' : 'Copy Address'}
          </button>
          <button
            type="button"
            onClick={startEditing}
            className="px-3 py-1.5 text-xs font-medium rounded border border-claw-border text-claw-text hover:bg-claw-surface transition-colors"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 text-xs font-medium rounded border border-red-800/40 text-red-400 hover:bg-red-900/20 disabled:opacity-50 transition-colors ml-auto"
          >
            {deleting ? 'Removing...' : 'Delete'}
          </button>
        </div>
      </div>
    );
  }

  // --- No-wallet state (prompt to add) ---
  if (state === 'no-wallet') {
    return (
      <div className="bg-claw-surface border border-claw-border rounded-lg p-4 text-center">
        <p className="text-sm text-claw-text-muted mb-3">
          No donation wallet configured. Add one so viewers can send tips and donations.
        </p>
        <button
          type="button"
          onClick={startEditing}
          className="px-4 py-2 bg-claw-accent text-white text-sm font-semibold rounded hover:bg-claw-accent-hover transition-colors"
        >
          Add Wallet
        </button>
      </div>
    );
  }

  // --- Editing state ---
  const inputCls = "w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text placeholder:text-claw-text-muted font-mono focus:outline-none focus:border-claw-accent";

  return (
    <div className="space-y-5">
      {/* Network — fixed to Base for V1 */}
      <div>
        <label className="block text-sm font-medium mb-1">Network</label>
        <div className="flex items-center gap-2 px-3 py-2 bg-claw-bg border border-claw-border rounded">
          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-claw-surface border border-claw-border text-claw-text-muted uppercase tracking-wide">
            Base
          </span>
          <span className="text-sm text-claw-text-muted">Ethereum L2</span>
        </div>
        <p className="text-xs text-claw-text-muted mt-1">Only Base is supported in V1.</p>
      </div>

      {/* Address input */}
      <div>
        <label className="block text-sm font-medium mb-1">Wallet Address</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value.trim())}
          placeholder="0x..."
          className={inputCls}
          autoComplete="off"
          spellCheck={false}
        />
        {address && !addressValid && (
          <p className="text-xs text-red-400 mt-1">
            Must be a valid EVM address (0x followed by 40 hex characters).
          </p>
        )}
        {address && addressValid && (
          <p className="text-xs text-green-500 mt-1">Address format looks valid.</p>
        )}
      </div>

      {/* Confirm address */}
      <div>
        <label className="block text-sm font-medium mb-1">Confirm Wallet Address</label>
        <input
          type="text"
          value={confirmAddress}
          onChange={(e) => setConfirmAddress(e.target.value.trim())}
          placeholder="Re-enter address to confirm"
          className={inputCls}
          autoComplete="off"
          spellCheck={false}
        />
        {confirmAddress && !addressesMatch && (
          <p className="text-xs text-red-400 mt-1">Addresses do not match.</p>
        )}
        {confirmAddress && addressesMatch && (
          <p className="text-xs text-green-500 mt-1">Addresses match.</p>
        )}
      </div>

      {/* Disclaimer checkbox */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={disclaimerChecked}
          onChange={(e) => setDisclaimerChecked(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-claw-border accent-claw-accent flex-shrink-0"
        />
        <span className="text-xs text-claw-text-muted leading-relaxed group-hover:text-claw-text transition-colors">
          I understand that if I enter the wrong wallet address, funds sent to it cannot be recovered.
          LiveClaw is not responsible for lost funds.
        </span>
      </label>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saving}
          className="px-5 py-2 bg-claw-accent text-white text-sm font-semibold rounded hover:bg-claw-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Wallet'}
        </button>
        <button
          type="button"
          onClick={cancelEditing}
          className="px-4 py-2 text-sm text-claw-text-muted hover:text-claw-text border border-claw-border rounded hover:bg-claw-surface transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
