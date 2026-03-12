'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Emote {
  id: string;
  name: string;
  imageUrl: string;
  tier: string | null;
}

interface EmotePickerProps {
  agentId: string;
  userId: string | null;
  onSelect: (emoteName: string) => void;
  onClose: () => void;
}

export function EmotePicker({ agentId, userId, onSelect, onClose }: EmotePickerProps) {
  const [emotes, setEmotes] = useState<Emote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = userId
      ? `${API_URL}/emotes/agent/${agentId}/available?userId=${userId}`
      : `${API_URL}/emotes/agent/${agentId}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setEmotes(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [agentId, userId]);

  return (
    <div className="absolute bottom-full right-0 mb-2 w-[280px] bg-claw-surface border border-claw-border rounded-lg shadow-xl z-10">
      <div className="p-2 border-b border-claw-border flex items-center justify-between">
        <span className="text-xs font-semibold text-claw-text-muted">Emotes</span>
        <button
          onClick={onClose}
          className="text-claw-text-muted hover:text-claw-text text-xs"
        >
          ✕
        </button>
      </div>
      <div className="p-2 max-h-[200px] overflow-y-auto">
        {loading ? (
          <p className="text-center text-claw-text-muted text-xs py-4">Loading...</p>
        ) : emotes.length === 0 ? (
          <p className="text-center text-claw-text-muted text-xs py-4">No emotes available</p>
        ) : (
          <div className="grid grid-cols-6 gap-1">
            {emotes.map((emote) => (
              <button
                key={emote.id}
                onClick={() => {
                  onSelect(`:${emote.name}:`);
                  onClose();
                }}
                title={`:${emote.name}:`}
                className="w-10 h-10 flex items-center justify-center rounded hover:bg-claw-card transition-colors"
              >
                <img
                  src={emote.imageUrl}
                  alt={emote.name}
                  className="w-6 h-6 object-contain"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
