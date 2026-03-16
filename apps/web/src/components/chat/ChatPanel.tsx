'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useChat } from '@/hooks/useChat';
import { useUser } from '@/contexts/UserContext';
import { DonationForm } from './DonationForm';
import { EmotePicker } from './EmotePicker';

interface ChatPanelProps {
  streamId: string;
  agentId: string;
  agentName: string;
}

const BADGE_STYLES: Record<string, { color: string; icon: string }> = {
  tier_1: { color: 'text-blue-400', icon: '\u2605' },
  tier_2: { color: 'text-purple-400', icon: '\u2605' },
  tier_3: { color: 'text-yellow-400', icon: '\u2666' },
};

const USERNAME_COLORS = [
  'text-red-400', 'text-orange-400', 'text-yellow-400', 'text-green-400',
  'text-teal-400', 'text-cyan-400', 'text-blue-400', 'text-indigo-400',
  'text-purple-400', 'text-pink-400', 'text-rose-400', 'text-emerald-400',
];

function getUsernameColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  }
  return USERNAME_COLORS[hash % USERNAME_COLORS.length];
}

function renderMessageContent(
  content: string,
  emotes?: Array<{ name: string; imageUrl: string }>,
) {
  if (!emotes || emotes.length === 0) return content;
  const emoteMap = new Map(emotes.map((e) => [e.name, e.imageUrl]));
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  const regex = /:([\w]+):/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const url = emoteMap.get(match[1]);
    if (url) {
      if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index));
      parts.push(<img key={match.index} src={url} alt={match[1]} title={`:${match[1]}:`} className="inline-block w-6 h-6 align-middle mx-0.5" />);
      lastIndex = match.index + match[0].length;
    }
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  return parts.length > 0 ? parts : content;
}

export function ChatPanel({ streamId, agentId, agentName }: ChatPanelProps) {
  const { messages, viewerCount, sendMessage, connected, slowMode, rateLimited } = useChat(streamId, agentId);
  const { user, isLoggedIn, setShowLoginModal } = useUser();
  const [input, setInput] = useState('');
  const [showDonation, setShowDonation] = useState(false);
  const [showEmotePicker, setShowEmotePicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isAtBottomRef = useRef(true);

  // Smart auto-scroll: only scroll to bottom if user is already at the bottom
  const checkIsAtBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const threshold = 60; // px tolerance
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  useEffect(() => {
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (!isLoggedIn) { setShowLoginModal(true); return; }
    if (rateLimited) return;
    sendMessage(input.trim(), agentId);
    setInput('');
    // Force scroll to bottom on own message
    isAtBottomRef.current = true;
  };

  const handleEmoteSelect = (emoteName: string) => {
    setInput((prev) => prev + emoteName);
    inputRef.current?.focus();
  };

  const handleDonationClick = () => {
    if (!isLoggedIn) { setShowLoginModal(true); return; }
    setShowDonation(true);
  };

  return (
    <div className="flex flex-col h-full bg-claw-surface">
      {/* Header — compact */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-claw-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-claw-accent/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="font-semibold text-xs tracking-tight text-claw-text/80">Chat</span>
          {slowMode > 0 && (
            <span className="text-[9px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded px-1.5 py-px font-semibold">
              Slow {slowMode}s
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-claw-card/80 rounded border border-claw-border/50">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-claw-live opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-claw-live" />
          </span>
          <span className="text-[11px] font-bold text-claw-text tabular-nums">
            {viewerCount}
          </span>
        </div>
      </div>

      {/* Messages — the protagonist */}
      <div
        ref={messagesContainerRef}
        onScroll={checkIsAtBottom}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 min-h-0"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-50">
            <svg className="w-10 h-10 text-claw-text-muted/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-xs text-claw-text-muted/40">
              Say hi to {agentName}
            </p>
          </div>
        )}
        {messages.map((msg) => {
          if (msg.type === 'system') {
            return (
              <div key={msg.id} className="text-[11px] text-claw-text-muted/50 italic py-0.5 text-center">
                {msg.content}
              </div>
            );
          }
          if (msg.type === 'donation') {
            return (
              <div key={msg.id} className="bg-gradient-to-r from-yellow-500/10 to-amber-500/5 border border-yellow-500/20 rounded-lg p-2.5 text-sm my-1 shadow-sm shadow-yellow-900/10">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <svg className="w-3 h-3 text-yellow-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.94s4.18 1.36 4.18 3.85c0 1.89-1.44 2.98-3.12 3.19z"/></svg>
                  <span className="font-bold text-yellow-400 text-xs">{msg.username}</span>
                  <span className="text-yellow-300/80 font-bold text-[11px]">{msg.amount?.toFixed(6)} ETH</span>
                </div>
                {msg.content && <p className="text-yellow-100/80 text-xs">{msg.content}</p>}
              </div>
            );
          }
          if (msg.deleted) {
            return <div key={msg.id} className="text-[11px] text-claw-text-muted/30 italic">[message deleted]</div>;
          }
          const badge = msg.badge ? BADGE_STYLES[msg.badge] : null;
          const usernameColor = msg.type === 'agent' ? 'text-claw-accent' : getUsernameColor(msg.username);
          return (
            <div key={msg.id} className="text-[13px] break-words leading-[1.5] hover:bg-white/[0.02] rounded px-1 py-[2px] -mx-1 transition-colors">
              {badge && <span className={`${badge.color} mr-0.5 text-[11px]`} title={msg.badge || ''}>{badge.icon}</span>}
              <span className={`font-semibold ${usernameColor}`}>{msg.username}</span>
              <span className="text-claw-text-muted/50">: </span>
              <span className="text-claw-text/90">{renderMessageContent(msg.content, msg.emotes)}</span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input — compact, always accessible */}
      <div className="border-t border-claw-border flex-shrink-0">
        {(!connected || rateLimited) && (
          <div className="px-3 pt-1.5 pb-0">
            {!connected && (
              <div className="flex items-center gap-1.5 text-[11px] text-yellow-500/80">
                <div className="w-3 h-3 border-2 border-yellow-500/60 border-t-transparent rounded-full animate-spin" />
                Connecting...
              </div>
            )}
            {rateLimited && (
              <p className="text-[11px] text-orange-400/80">Slow down</p>
            )}
          </div>
        )}

        <form onSubmit={handleSend} className="p-2">
          <div className="flex gap-1.5">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isLoggedIn ? 'Send a message' : 'Log in to chat'}
                className="w-full bg-claw-bg/80 border border-claw-border/80 rounded-lg px-3 py-2 pr-14 text-sm text-claw-text placeholder:text-claw-text-muted/40 focus:outline-none focus:border-claw-accent/50 focus:bg-claw-bg disabled:opacity-30 transition-all"
                disabled={!connected || rateLimited}
                maxLength={500}
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmotePicker(!showEmotePicker)}
                    className="text-claw-text-muted/40 hover:text-claw-accent p-1 rounded hover:bg-claw-accent/10 transition-colors"
                    title="Emotes"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
                    </svg>
                  </button>
                  {showEmotePicker && (
                    <EmotePicker agentId={agentId} userId={user?.id || null} onSelect={handleEmoteSelect} onClose={() => setShowEmotePicker(false)} />
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleDonationClick}
                  className="text-yellow-500/30 hover:text-yellow-400 p-1 rounded hover:bg-yellow-500/10 transition-colors"
                  title="Donate"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.94s4.18 1.36 4.18 3.85c0 1.89-1.44 2.98-3.12 3.19z"/></svg>
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={!connected || !input.trim() || rateLimited}
              className="px-3 py-2 bg-claw-accent text-white text-sm font-bold rounded-lg hover:bg-claw-accent-hover disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              Chat
            </button>
          </div>
        </form>
      </div>

      {showDonation && (
        <DonationForm agentId={agentId} streamId={streamId} onClose={() => setShowDonation(false)} />
      )}
    </div>
  );
}
