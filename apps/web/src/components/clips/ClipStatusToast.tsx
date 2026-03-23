'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface ClipStatusToastProps {
  shareId: string;
  onClose: () => void;
}

export function ClipStatusToast({ shareId, onClose }: ClipStatusToastProps) {
  const [status, setStatus] = useState<string>('pending');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const clipUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/clip/${shareId}`
    : `/clip/${shareId}`;

  const pollStatus = useCallback(async () => {
    try {
      const data = await api<{ status: string; errorMessage: string | null }>(
        `/clips/${shareId}/status`,
      );
      setStatus(data.status);
      if (data.status === 'failed') {
        setError(data.errorMessage || 'Processing failed');
      }
    } catch {
      // If polling fails, keep current state
    }
  }, [shareId]);

  useEffect(() => {
    if (status === 'ready' || status === 'failed') return;
    const interval = setInterval(pollStatus, 3000);
    pollStatus(); // immediate first poll
    return () => clearInterval(interval);
  }, [status, pollStatus]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(clipUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-claw-surface border border-claw-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden animate-fade-in-up">
      <div className="flex items-center justify-between px-4 py-3 border-b border-claw-border">
        <div className="flex items-center gap-2">
          {status === 'ready' ? (
            <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : status === 'failed' ? (
            <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          ) : (
            <div className="w-4 h-4 border-2 border-claw-accent/30 border-t-claw-accent rounded-full animate-spin" />
          )}
          <span className="text-sm font-semibold">
            {status === 'ready'
              ? 'Clip Ready!'
              : status === 'failed'
                ? 'Clip Failed'
                : 'Creating Clip...'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-claw-text-muted hover:text-claw-text transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="px-4 py-3">
        {status === 'ready' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <a
                href={`/clip/${shareId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 text-sm font-semibold text-center rounded-lg bg-claw-accent text-white hover:bg-claw-accent/90 transition-colors"
              >
                View Clip
              </a>
              <button
                onClick={handleCopy}
                className="px-3 py-2 text-sm font-semibold rounded-lg bg-claw-card border border-claw-border hover:bg-claw-bg transition-colors"
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        )}
        {status === 'failed' && (
          <p className="text-sm text-red-400/80">
            {error || 'Something went wrong creating this clip.'}
          </p>
        )}
        {status !== 'ready' && status !== 'failed' && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-claw-bg rounded-full overflow-hidden">
              <div className="h-full bg-claw-accent/60 rounded-full animate-pulse w-2/3" />
            </div>
            <span className="text-xs text-claw-text-muted">Processing</span>
          </div>
        )}
      </div>
    </div>
  );
}
