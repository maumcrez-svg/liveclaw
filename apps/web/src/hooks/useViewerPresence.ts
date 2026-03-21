'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
const STORAGE_KEY = 'liveclaw_user';

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

/**
 * Dedicated viewer presence hook — decoupled from chat.
 * Connects via Socket.IO, emits join_stream + heartbeat, tracks viewer count.
 * Call at the page level so every viewer is counted regardless of chat visibility.
 */
export function useViewerPresence(streamId: string | null) {
  const [viewerCount, setViewerCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!streamId) return;

    const token = getAuthToken();

    const socket = io(WS_URL, {
      transports: ['websocket'],
      auth: token ? { token } : {},
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.info(`[Presence] Connected, joining stream ${streamId}`);
      socket.emit('join_stream', { streamId });
    });

    socket.on('viewer_count', (data: { streamId: string; count: number }) => {
      if (data.streamId === streamId) {
        setViewerCount(data.count);
      }
    });

    // Heartbeat: tell server this viewer is still actively watching
    const heartbeat = setInterval(() => {
      if (socket.connected) {
        socket.emit('viewer_heartbeat');
      }
    }, 30_000);

    return () => {
      clearInterval(heartbeat);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [streamId]);

  return { viewerCount };
}
