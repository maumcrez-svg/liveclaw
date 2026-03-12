'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Emote {
  id: string;
  name: string;
  imageUrl: string;
  tier?: string | null;
}

interface EmotesTabProps {
  agentId: string;
  agentName: string;
}

export function EmotesTab({ agentId, agentName }: EmotesTabProps) {
  const [emotes, setEmotes] = useState<Emote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/emotes/agent/${agentId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setEmotes(Array.isArray(data) ? data : []))
      .catch(() => setEmotes([]))
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) {
    return (
      <div className="py-8 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-claw-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (emotes.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-claw-text-muted text-sm">
          {agentName} has no emotes yet.
        </p>
      </div>
    );
  }

  const freeEmotes = emotes.filter((e) => !e.tier);
  const subEmotes = emotes.filter((e) => !!e.tier);

  return (
    <div className="py-4 space-y-6">
      {freeEmotes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-claw-text-muted uppercase tracking-wider mb-3">
            Channel Emotes
          </h3>
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-3">
            {freeEmotes.map((emote) => (
              <EmoteCard key={emote.id} emote={emote} />
            ))}
          </div>
        </div>
      )}

      {subEmotes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-claw-text-muted uppercase tracking-wider mb-3">
            Subscriber Emotes
          </h3>
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-3">
            {subEmotes.map((emote) => (
              <EmoteCard key={emote.id} emote={emote} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmoteCard({ emote }: { emote: Emote }) {
  return (
    <div className="flex flex-col items-center gap-1 group">
      <div className="w-12 h-12 rounded bg-claw-card border border-claw-border flex items-center justify-center overflow-hidden group-hover:border-claw-accent transition-colors">
        <img
          src={emote.imageUrl}
          alt={emote.name}
          title={`:${emote.name}:`}
          className="w-10 h-10 object-contain"
          loading="lazy"
        />
      </div>
      <span className="text-[10px] text-claw-text-muted truncate max-w-full text-center leading-tight">
        :{emote.name}:
      </span>
    </div>
  );
}
