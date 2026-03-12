'use client';

import Link from 'next/link';
import { FollowButton } from '@/components/stream/FollowButton';
import { SubscribeButton } from '@/components/stream/SubscribeButton';
import { useState } from 'react';
import { DonationForm } from '@/components/chat/DonationForm';
import { useUser } from '@/contexts/UserContext';

interface ChannelHeaderProps {
  agent: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    status: string;
    followerCount?: number;
    subscriberCount?: number;
    agentType?: string;
    defaultTags?: string[];
    category?: { id: string; name: string; slug: string } | null;
    externalLinks?: Record<string, string>;
    createdAt?: string;
  };
  stream: {
    id: string;
    title?: string;
    viewerCount?: number;
    currentViewers?: number;
    startedAt?: string;
  } | null;
}

function formatUptime(startedAt: string): string {
  const diff = Date.now() - new Date(startedAt).getTime();
  if (diff < 0) return '';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getStreamTitle(agent: ChannelHeaderProps['agent'], stream: ChannelHeaderProps['stream']): string {
  if (stream?.title && stream.title !== 'Untitled Stream') return stream.title;
  if (agent.status === 'live') return `${agent.name} is live`;
  return agent.description || `Welcome to ${agent.name}'s channel`;
}

const SOCIAL_ICONS: Record<string, { label: string; icon: JSX.Element }> = {
  twitter: {
    label: 'Twitter',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  telegram: {
    label: 'Telegram',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
  website: {
    label: 'Website',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  docs: {
    label: 'Docs',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  wallet: {
    label: 'Wallet',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M2 10h20" />
        <circle cx="17" cy="14" r="1.5" />
      </svg>
    ),
  },
};

export function ChannelHeader({ agent, stream }: ChannelHeaderProps) {
  const { isLoggedIn, setShowLoginModal } = useUser();
  const [showDonation, setShowDonation] = useState(false);

  const handleDonateClick = () => {
    if (!isLoggedIn) { setShowLoginModal(true); return; }
    setShowDonation(true);
  };

  const isLive = agent.status === 'live';
  const viewers = stream?.viewerCount ?? stream?.currentViewers;
  const streamTitle = getStreamTitle(agent, stream);
  const links = agent.externalLinks || {};
  const hasLinks = Object.keys(links).length > 0;

  return (
    <>
      {/* ── Channel Header Bar ── */}
      <div className="px-4 md:px-6 py-4 border-b border-claw-border bg-claw-bg">
        <div className="flex items-start gap-4">
          {/* Avatar + LIVE badge */}
          <div className="relative flex-shrink-0">
            <div className={`rounded-full p-[2px] ${
              isLive
                ? 'bg-gradient-to-br from-claw-live to-red-700'
                : 'bg-claw-border'
            }`}>
              {agent.avatarUrl ? (
                <img
                  src={agent.avatarUrl}
                  alt={agent.name}
                  className="w-16 h-16 rounded-full object-cover border-[2.5px] border-claw-bg"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-claw-card flex items-center justify-center text-claw-accent text-2xl font-bold border-[2.5px] border-claw-bg">
                  {agent.name[0]?.toUpperCase()}
                </div>
              )}
            </div>
            {isLive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-claw-live text-white text-[9px] font-black uppercase tracking-wider px-2 py-[1px] rounded-sm leading-tight">
                LIVE
              </span>
            )}
          </div>

          {/* Info block */}
          <div className="flex-1 min-w-0">
            {/* Name */}
            <h1 className="text-xl font-extrabold leading-tight tracking-tight mb-0.5">
              {agent.name}
            </h1>

            {/* Stream title */}
            <p className="text-sm text-claw-text/80 leading-snug mb-2 truncate">
              {streamTitle}
            </p>

            {/* Category + Tags */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {agent.category && (
                <Link
                  href={`/browse/${agent.category.slug}`}
                  className="text-xs font-semibold text-claw-accent hover:underline"
                >
                  {agent.category.name}
                </Link>
              )}
              {agent.defaultTags?.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-[11px] bg-claw-card/80 text-claw-text-muted rounded-full border border-claw-border/60"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Right side: metrics + actions */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0 pt-1">
            {/* Metrics cluster */}
            {isLive && (
              <div className="flex items-center gap-3 mr-1 text-sm text-claw-text-muted">
                {viewers != null && (
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-claw-live" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                    </svg>
                    <span className="font-bold text-claw-live tabular-nums">{viewers.toLocaleString()}</span>
                  </div>
                )}
                {stream?.startedAt && (
                  <span className="tabular-nums">{formatUptime(stream.startedAt)}</span>
                )}
              </div>
            )}

            {/* Action buttons */}
            <FollowButton agentId={agent.id} followerCount={agent.followerCount || 0} />
            <SubscribeButton agentId={agent.id} agentName={agent.name} />
            {stream && (
              <button
                onClick={handleDonateClick}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-md bg-gradient-to-r from-yellow-500 to-amber-600 text-white hover:from-yellow-400 hover:to-amber-500 transition-all shadow-sm shadow-yellow-900/30"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.94s4.18 1.36 4.18 3.85c0 1.89-1.44 2.98-3.12 3.19z"/>
                </svg>
                Donate
              </button>
            )}
          </div>
        </div>

        {/* Mobile actions */}
        <div className="flex md:hidden items-center gap-2 mt-3 flex-wrap">
          {isLive && viewers != null && (
            <div className="flex items-center gap-1.5 text-sm mr-auto">
              <svg className="w-4 h-4 text-claw-live" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
              </svg>
              <span className="font-bold text-claw-live tabular-nums">{viewers.toLocaleString()}</span>
              {stream?.startedAt && (
                <span className="text-claw-text-muted tabular-nums ml-2">{formatUptime(stream.startedAt)}</span>
              )}
            </div>
          )}
          <FollowButton agentId={agent.id} followerCount={agent.followerCount || 0} />
          <SubscribeButton agentId={agent.id} agentName={agent.name} />
          {stream && (
            <button
              onClick={handleDonateClick}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-md bg-gradient-to-r from-yellow-500 to-amber-600 text-white hover:from-yellow-400 hover:to-amber-500 transition-all shadow-sm shadow-yellow-900/30"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.94s4.18 1.36 4.18 3.85c0 1.89-1.44 2.98-3.12 3.19z"/>
              </svg>
              Donate
            </button>
          )}
        </div>
      </div>

      {/* ── About Section ── */}
      <div className="px-4 md:px-6 py-4 border-b border-claw-border bg-claw-bg">
        <h2 className="text-base font-bold mb-3">About {agent.name}</h2>

        <div className="bg-claw-surface rounded-lg border border-claw-border overflow-hidden">
          <div className="flex flex-col md:flex-row">
            {/* Left: followers + bio */}
            <div className="flex-1 p-4 md:border-r md:border-claw-border">
              <p className="text-lg font-bold mb-0.5">
                {formatCount(agent.followerCount || 0)}
                <span className="text-sm font-normal text-claw-text-muted ml-1.5">followers</span>
              </p>
              {agent.description ? (
                <p className="text-sm text-claw-text/80 leading-relaxed mt-2 whitespace-pre-wrap">
                  {agent.description}
                </p>
              ) : (
                <p className="text-sm text-claw-text-muted/50 italic mt-2">No bio yet.</p>
              )}
            </div>

            {/* Right: external links */}
            {hasLinks && (
              <div className="p-4 md:w-56 border-t md:border-t-0 border-claw-border">
                <div className="space-y-2">
                  {Object.entries(links).map(([key, url]) => {
                    const info = SOCIAL_ICONS[key];
                    if (!info || !url) return null;
                    return (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 text-sm text-claw-text hover:text-claw-accent transition-colors group"
                      >
                        <span className="text-claw-text-muted group-hover:text-claw-accent transition-colors">
                          {info.icon}
                        </span>
                        {info.label}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showDonation && stream && (
        <DonationForm
          agentId={agent.id}
          streamId={stream.id}
          onClose={() => setShowDonation(false)}
        />
      )}
    </>
  );
}
