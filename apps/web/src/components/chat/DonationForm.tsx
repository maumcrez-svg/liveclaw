'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api';

const PRESET_AMOUNTS = [1, 5, 10, 25, 50, 100];

interface DonationFormProps {
  agentId: string;
  streamId: string;
  onClose: () => void;
}

export function DonationForm({ agentId, streamId, onClose }: DonationFormProps) {
  const { user } = useUser();
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!num || num < 0.01) {
      setError('Enter a valid amount');
      return;
    }
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const data = await api<{ url: string }>('/donations/checkout', {
        method: 'POST',
        body: JSON.stringify({
          agentId,
          streamId,
          amount: num,
          message: message.trim(),
        }),
      });
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error('Failed to create checkout session');
        setError('Failed to create checkout session');
      }
    } catch {
      toast.error('Failed to send donation');
      setError('Failed to send donation');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-claw-surface border border-claw-border rounded-lg p-6 w-[360px]">
        <h2 className="text-lg font-bold mb-4">Send a Donation</h2>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESET_AMOUNTS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset))}
                className={`px-3 py-1 text-sm rounded border transition-colors ${
                  amount === String(preset)
                    ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                    : 'border-claw-border hover:border-claw-accent'
                }`}
              >
                ${preset}
              </button>
            ))}
          </div>
          <div className="relative mb-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-claw-text-muted">$</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-claw-bg border border-claw-border rounded pl-7 pr-3 py-2 text-sm text-claw-text placeholder:text-claw-text-muted focus:outline-none focus:border-claw-accent"
            />
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a message (optional)"
            maxLength={200}
            rows={3}
            className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text placeholder:text-claw-text-muted focus:outline-none focus:border-claw-accent resize-none mb-2"
          />
          {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm border border-claw-border rounded hover:bg-claw-card transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !amount}
              className="flex-1 px-4 py-2 bg-yellow-600 text-white text-sm font-semibold rounded hover:bg-yellow-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Redirecting...' : `Donate $${amount || '0'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
