'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

/**
 * Global real-time viewer counts for all live streams.
 * Connects to Socket.IO without auth (anonymous) and subscribes to viewer_count_update events.
 * Returns a Map<agentId, viewerCount> that updates in real-time.
 */
export function useViewerCounts(): Map<string, number> {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ['websocket'],
      auth: {},
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe_counts');
    });

    socket.on('viewer_count_update', (data: { agentId: string; count: number }) => {
      setCounts((prev) => {
        const next = new Map(prev);
        if (data.count > 0) {
          next.set(data.agentId, data.count);
        } else {
          next.delete(data.agentId);
        }
        return next;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return counts;
}
