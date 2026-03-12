'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

const STORAGE_KEY = 'liveclaw_user';

export interface ChatMessage {
  id: string;
  streamId: string;
  username: string;
  content: string;
  type: string;
  badge?: string | null;
  emotes?: Array<{ name: string; imageUrl: string }>;
  amount?: number;
  currency?: string;
  createdAt: string;
  deleted?: boolean;
}

function getAuthToken(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed.token || null;
  } catch {
    return null;
  }
}

export function useChat(streamId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [slowMode, setSlowMode] = useState(0); // seconds; 0 = disabled
  const [rateLimited, setRateLimited] = useState(false);
  const rateLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getAuthToken();

    const socket = io(WS_URL, {
      transports: ['websocket'],
      auth: token ? { token } : {},
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_stream', { streamId });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('new_message', (message: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-200), message]);
    });

    socket.on('viewer_count', (data: { streamId: string; count: number }) => {
      if (data.streamId === streamId) {
        setViewerCount(data.count);
      }
    });

    socket.on('message_deleted', (data: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId ? { ...msg, deleted: true } : msg,
        ),
      );
    });

    socket.on('user_banned', (data: { username: string; streamId: string }) => {
      if (data.streamId !== streamId) return;
      const systemMsg: ChatMessage = {
        id: `ban-${Date.now()}`,
        streamId,
        username: 'System',
        content: `${data.username} has been banned from chat.`,
        type: 'system',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev.slice(-200), systemMsg]);
    });

    socket.on('user_timed_out', (data: { username: string; duration: number; streamId: string }) => {
      if (data.streamId !== streamId) return;
      const systemMsg: ChatMessage = {
        id: `timeout-${Date.now()}`,
        streamId,
        username: 'System',
        content: `${data.username} has been timed out for ${data.duration}s.`,
        type: 'system',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev.slice(-200), systemMsg]);
    });

    socket.on('slow_mode_changed', (data: { seconds: number; streamId: string }) => {
      if (data.streamId !== streamId) return;
      setSlowMode(data.seconds);
    });

    socket.on('rate_limited', () => {
      setRateLimited(true);
      if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
      rateLimitTimerRef.current = setTimeout(() => setRateLimited(false), 3000);
    });

    socket.on('slow_mode_wait', (data: { waitSeconds: number }) => {
      setRateLimited(true);
      if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
      rateLimitTimerRef.current = setTimeout(
        () => setRateLimited(false),
        (data.waitSeconds ?? 3) * 1000,
      );
    });

    return () => {
      socket.emit('leave_stream', { streamId });
      socket.disconnect();
      if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
    };
  }, [streamId]);

  // sendMessage no longer needs username/userId — server uses socket.data from JWT
  const sendMessage = useCallback(
    (content: string, agentId?: string) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('send_message', { streamId, content, agentId });
      }
    },
    [streamId],
  );

  return { messages, viewerCount, sendMessage, connected, slowMode, rateLimited };
}
