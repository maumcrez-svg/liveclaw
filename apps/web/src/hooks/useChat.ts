'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { StreamAlert } from '@/lib/alerts';
import { useSocket } from './useSocket';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

export function useChat(streamId: string, agentId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [slowMode, setSlowMode] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const [lastAlert, setLastAlert] = useState<StreamAlert | null>(null);
  const rateLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyLoadedRef = useRef(false);
  const socket = useSocket();

  // Load chat history on mount (before WebSocket connects)
  useEffect(() => {
    if (!agentId || historyLoadedRef.current) return;
    historyLoadedRef.current = true;

    fetch(`${API_URL}/chat/${agentId}/messages?limit=50`)
      .then((res) => (res.ok ? res.json() : []))
      .then((history: ChatMessage[]) => {
        if (history.length > 0) {
          // History comes newest-first from Redis LRANGE, reverse for chronological
          const chronological = [...history].reverse();
          setMessages(chronological);
        }
      })
      .catch(() => {});
  }, [agentId]);

  useEffect(() => {
    let active = true;
    let chatJoined = false;

    const doJoinChat = () => {
      if (!active || chatJoined || !socket.connected) return;
      console.info(`[Chat] join_chat emit → ${streamId} (socket: ${socket.id})`);
      socket.emit('join_chat', { streamId }, (response: any) => {
        if (!active) return;
        chatJoined = true;
        console.info(`[Chat] join_chat ACK ← streamId: ${response?.streamId}`);
        setConnected(true);
      });
    };

    const onDisconnect = () => {
      chatJoined = false; // Reset so we re-join on reconnect
      setConnected(false);
      console.info('[Chat] Disconnected — will re-join on reconnect');
    };

    const onNewMessage = (message: ChatMessage) => {
      setMessages((prev) => {
        // Deduplicate by ID (history + real-time overlap)
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev.slice(-200), message];
      });
    };

    const onMessageDeleted = (data: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId ? { ...msg, deleted: true } : msg,
        ),
      );
    };

    const onUserBanned = (data: { username: string; streamId: string }) => {
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
    };

    const onUserTimedOut = (data: { username: string; duration: number; streamId: string }) => {
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
    };

    const onSlowModeChanged = (data: { seconds: number; streamId: string }) => {
      if (data.streamId !== streamId) return;
      setSlowMode(data.seconds);
    };

    const onStreamAlert = (alert: StreamAlert) => {
      setLastAlert(alert);
    };

    const onRateLimited = () => {
      setRateLimited(true);
      if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
      rateLimitTimerRef.current = setTimeout(() => setRateLimited(false), 3000);
    };

    const onSlowModeWait = (data: { waitSeconds: number }) => {
      setRateLimited(true);
      if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
      rateLimitTimerRef.current = setTimeout(
        () => setRateLimited(false),
        (data.waitSeconds ?? 3) * 1000,
      );
    };

    // Register connect listener FIRST (before any emit attempt)
    socket.on('connect', doJoinChat);

    // Then try immediately (in case socket is already connected)
    doJoinChat();

    // Retry with fast initial attempts, then slow down
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    const scheduleRetry = () => {
      if (chatJoined || !active) return;
      const delay = retryCount < 5 ? 500 : 3000;
      retryTimer = setTimeout(() => {
        retryCount++;
        doJoinChat();
        scheduleRetry();
      }, delay);
    };
    scheduleRetry();
    socket.on('disconnect', onDisconnect);
    socket.on('new_message', onNewMessage);
    socket.on('message_deleted', onMessageDeleted);
    socket.on('user_banned', onUserBanned);
    socket.on('user_timed_out', onUserTimedOut);
    socket.on('slow_mode_changed', onSlowModeChanged);
    socket.on('stream_alert', onStreamAlert);
    socket.on('rate_limited', onRateLimited);
    socket.on('slow_mode_wait', onSlowModeWait);

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      socket.off('connect', doJoinChat);
      socket.off('disconnect', onDisconnect);
      socket.off('new_message', onNewMessage);
      socket.off('message_deleted', onMessageDeleted);
      socket.off('user_banned', onUserBanned);
      socket.off('user_timed_out', onUserTimedOut);
      socket.off('slow_mode_changed', onSlowModeChanged);
      socket.off('stream_alert', onStreamAlert);
      socket.off('rate_limited', onRateLimited);
      socket.off('slow_mode_wait', onSlowModeWait);
      if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
    };
  }, [streamId, socket]);

  const sendMessage = useCallback(
    (content: string, agentId?: string) => {
      if (socket?.connected) {
        socket.emit('send_message', { streamId, content, agentId });
      }
    },
    [streamId, socket],
  );

  return { messages, sendMessage, connected, slowMode, rateLimited, lastAlert };
}
