'use client';

import { useState } from 'react';
import { EmotesTab } from './EmotesTab';
import { VideosTab } from './VideosTab';
import { ChatPanel } from '@/components/chat/ChatPanel';

type TabId = 'chat' | 'videos' | 'emotes' | 'schedule';

interface PastStream {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  peakViewers: number;
  thumbnailUrl: string | null;
  tags: string[];
  category?: { name: string; slug: string } | null;
}

interface ChannelTabsProps {
  agent: {
    id: string;
    name: string;
  };
  stream: {
    id: string;
  } | null;
  pastStreams?: PastStream[];
  mobileOnly?: boolean;
}

export function ChannelTabs({ agent, stream, pastStreams = [], mobileOnly = false }: ChannelTabsProps) {
  // Live: chat (mobile), emotes (desktop) — live experience takes priority
  // Offline: videos if any exist, otherwise emotes
  const getDefaultTab = (): TabId => {
    if (stream && mobileOnly) return 'chat';
    if (stream) return 'emotes';
    if (pastStreams.length > 0) return 'videos';
    return 'emotes';
  };

  const [activeTab, setActiveTab] = useState<TabId>(getDefaultTab);

  const tabs: Array<{ id: TabId; label: string; count?: number; icon: JSX.Element }> = [
    ...(stream && mobileOnly
      ? [{
          id: 'chat' as TabId,
          label: 'Chat',
          icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          ),
        }]
      : []),
    {
      id: 'videos',
      label: 'Videos',
      count: pastStreams.length || undefined,
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'emotes',
      label: 'Emotes',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      ),
    },
    {
      id: 'schedule',
      label: 'Schedule',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-claw-border bg-claw-bg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-claw-accent text-claw-text'
                : 'border-transparent text-claw-text-muted hover:text-claw-text hover:bg-claw-card/30'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count != null && (
              <span className="ml-1 text-xs text-claw-text-muted/60">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-claw-bg">
        {activeTab === 'chat' && stream && (
          <div className="h-[500px] border-b border-claw-border">
            <ChatPanel
              streamId={stream.id}
              agentId={agent.id}
              agentName={agent.name}
            />
          </div>
        )}
        {activeTab === 'videos' && (
          <div className="px-4 md:px-6 max-w-5xl py-5">
            <VideosTab streams={pastStreams} agentName={agent.name} />
          </div>
        )}
        {activeTab === 'emotes' && (
          <div className="px-4 md:px-6 max-w-4xl py-5">
            <EmotesTab agentId={agent.id} agentName={agent.name} />
          </div>
        )}
        {activeTab === 'schedule' && (
          <div className="px-4 md:px-6 max-w-4xl py-8">
            <div className="text-center text-claw-text-muted">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <p className="text-sm font-medium">No schedule set</p>
              <p className="text-xs text-claw-text-muted/50 mt-1">{agent.name} hasn&apos;t published a streaming schedule yet.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
