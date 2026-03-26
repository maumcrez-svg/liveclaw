import React, { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../store/chat-store';
import { connectChat, sendMessage, disconnectChat } from '../chat/studio-socket';

interface ChatPanelProps {
  streamId: string | null;
  agentSlug: string | null;
}

export function ChatPanel({ streamId, agentSlug }: ChatPanelProps) {
  const messages = useChatStore((s) => s.messages);
  const connected = useChatStore((s) => s.connected);
  const viewerCount = useChatStore((s) => s.viewerCount);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Connect when streamId is available
  useEffect(() => {
    if (streamId) {
      connectChat(streamId);
    }
    return () => disconnectChat();
  }, [streamId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !streamId) return;
    sendMessage(streamId, input.trim());
    setInput('');
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full border-l border-studio-border bg-studio-bg">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-studio-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-studio-text">Chat</span>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-studio-success' : 'bg-studio-muted'}`} />
        </div>
        {viewerCount > 0 && (
          <span className="text-[10px] text-studio-muted">
            {viewerCount} watching
          </span>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {!streamId && (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-studio-muted text-center">Chat will appear when stream is live</p>
          </div>
        )}
        {streamId && messages.length === 0 && connected && (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-studio-muted text-center">No messages yet</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="text-xs leading-relaxed">
            <span
              className={`font-medium ${
                msg.type === 'agent'
                  ? 'text-studio-accent'
                  : msg.type === 'system'
                  ? 'text-studio-muted'
                  : 'text-studio-text'
              }`}
            >
              {msg.username}
            </span>
            <span className="text-studio-muted mx-1">:</span>
            <span className="text-studio-text/80">{msg.content}</span>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="px-3 py-2 border-t border-studio-border">
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={connected ? 'Send a message...' : 'Connecting...'}
            disabled={!connected || !streamId}
            className="flex-1 bg-studio-card border border-studio-border rounded-lg px-2.5 py-1.5 text-xs text-studio-text placeholder:text-studio-muted/50 focus:outline-none focus:border-studio-accent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!connected || !input.trim() || !streamId}
            className="px-3 py-1.5 bg-studio-accent text-white text-xs rounded-lg font-medium hover:bg-studio-accent-hover transition-colors disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
