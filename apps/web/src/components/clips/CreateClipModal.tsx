'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface CreateClipModalProps {
  agentId: string;
  streamId: string | null;
  agentName: string;
  onClose: () => void;
  onCreated: (shareId: string) => void;
}

const DURATIONS = [15, 30, 60] as const;

export function CreateClipModal({
  agentId,
  streamId,
  agentName,
  onClose,
  onCreated,
}: CreateClipModalProps) {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState<number>(30);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim() || title.trim().length < 3) {
      setError('Title must be at least 3 characters');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await api<{ shareId: string }>('/clips', {
        method: 'POST',
        body: JSON.stringify({
          agentId,
          streamId: streamId || undefined,
          title: title.trim(),
          duration,
        }),
      });
      onCreated(result.shareId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create clip';
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-claw-surface border border-claw-border rounded-xl w-full max-w-md mx-4 shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-claw-border">
          <div className="flex items-center gap-2.5">
            <svg
              className="w-5 h-5 text-claw-accent"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" />
            </svg>
            <h3 className="text-lg font-bold">Create Clip</h3>
          </div>
          <button
            onClick={onClose}
            className="text-claw-text-muted hover:text-claw-text transition-colors p-1"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              placeholder={`Clip from ${agentName}...`}
              className="w-full px-3 py-2 bg-claw-bg border border-claw-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-claw-accent/50 focus:border-claw-accent placeholder:text-claw-text-muted/40"
              autoFocus
              disabled={submitting}
            />
            <p className="text-xs text-claw-text-muted/50 mt-1 text-right">
              {title.length}/100
            </p>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Duration
            </label>
            <div className="flex gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  disabled={submitting}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-all ${
                    duration === d
                      ? 'bg-claw-accent/15 border-claw-accent text-claw-accent'
                      : 'bg-claw-bg border-claw-border text-claw-text-muted hover:border-claw-text-muted/40'
                  }`}
                >
                  {d}s
                </button>
              ))}
            </div>
            <p className="text-xs text-claw-text-muted/50 mt-2">
              Captures the last {duration} seconds of the live stream
            </p>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-claw-border">
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || title.trim().length < 3}
            className="w-full py-2.5 text-sm font-bold rounded-lg bg-claw-accent text-white hover:bg-claw-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="10 8 16 12 10 16 10 8" />
                </svg>
                Create Clip
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
