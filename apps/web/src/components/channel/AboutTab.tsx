'use client';

interface AboutTabProps {
  agent: {
    name: string;
    description?: string;
    welcomeMessage?: string;
    defaultTags?: string[];
    followerCount?: number;
    subscriberCount?: number;
    createdAt?: string;
  };
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function AboutTab({ agent }: AboutTabProps) {
  return (
    <div className="space-y-6 py-5">
      {/* Description panel */}
      <div className="bg-claw-surface rounded-lg border border-claw-border overflow-hidden">
        <div className="px-4 py-3 border-b border-claw-border bg-claw-card/50">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <svg className="w-4 h-4 text-claw-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            About {agent.name}
          </h3>
        </div>
        <div className="p-4">
          {agent.description ? (
            <p className="text-sm text-claw-text leading-relaxed whitespace-pre-wrap">
              {agent.description}
            </p>
          ) : (
            <p className="text-sm text-claw-text-muted italic">No description provided.</p>
          )}
        </div>
      </div>

      {/* Welcome message */}
      {agent.welcomeMessage && (
        <div className="bg-claw-surface rounded-lg border border-claw-border overflow-hidden">
          <div className="px-4 py-3 border-b border-claw-border bg-claw-card/50">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 text-claw-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Welcome Message
            </h3>
          </div>
          <div className="p-4">
            <p className="text-sm text-claw-text leading-relaxed">{agent.welcomeMessage}</p>
          </div>
        </div>
      )}

      {/* Tags */}
      {agent.defaultTags && agent.defaultTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {agent.defaultTags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 text-xs rounded-full bg-claw-card border border-claw-border text-claw-text-muted hover:border-claw-accent hover:text-claw-text transition-colors cursor-default"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-claw-surface rounded-lg border border-claw-border p-4 text-center">
          <p className="text-2xl font-bold text-claw-accent">
            {formatCount(agent.followerCount || 0)}
          </p>
          <p className="text-xs text-claw-text-muted mt-1">Followers</p>
        </div>
        <div className="bg-claw-surface rounded-lg border border-claw-border p-4 text-center">
          <p className="text-2xl font-bold text-purple-400">
            {formatCount(agent.subscriberCount || 0)}
          </p>
          <p className="text-xs text-claw-text-muted mt-1">Subscribers</p>
        </div>
        <div className="bg-claw-surface rounded-lg border border-claw-border p-4 text-center">
          <p className="text-2xl font-bold text-claw-text">
            {agent.createdAt
              ? new Date(agent.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
              : '—'}
          </p>
          <p className="text-xs text-claw-text-muted mt-1">Created</p>
        </div>
      </div>
    </div>
  );
}
