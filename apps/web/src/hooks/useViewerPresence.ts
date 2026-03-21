'use client';

import { useEffect, useState, useRef } from 'react';
import { useSocket } from './useSocket';

/**
 * Dedicated viewer presence hook — decoupled from chat.
 * Uses the shared singleton socket. Emits join_stream + heartbeat, tracks viewer count.
 * Call at the page level so every viewer is counted regardless of chat visibility.
 */
export function useViewerPresence(streamId: string | null) {
  const [viewerCount, setViewerCount] = useState(0);
  const socket = useSocket();
  const joinedStreamRef = useRef<string | null>(null);

  useEffect(() => {
    if (!streamId) return;

    const doJoin = () => {
      if (!socket.connected) return;
      if (joinedStreamRef.current === streamId) return; // already joined this stream
      console.info(`[Presence] Joining stream ${streamId} (socket ${socket.id})`);
      socket.emit('join_stream', { streamId });
      joinedStreamRef.current = streamId;
    };

    const onViewerCount = (data: { streamId: string; count: number }) => {
      if (data.streamId === streamId) {
        setViewerCount(data.count);
      }
    };

    // Try to join immediately
    doJoin();

    // Also join on (re)connect
    socket.on('connect', doJoin);
    socket.on('viewer_count', onViewerCount);

    // Retry: covers the case where socket is mid-handshake when effect runs
    const retryTimer = setTimeout(doJoin, 500);
    const retryTimer2 = setTimeout(doJoin, 2000);

    // Heartbeat: tell server this viewer is still actively watching
    const heartbeat = setInterval(() => {
      if (socket.connected) {
        socket.emit('viewer_heartbeat');
      }
    }, 30_000);

    return () => {
      clearTimeout(retryTimer);
      clearTimeout(retryTimer2);
      clearInterval(heartbeat);
      socket.off('connect', doJoin);
      socket.off('viewer_count', onViewerCount);
      // Leave stream instead of disconnecting — socket is shared
      if (joinedStreamRef.current === streamId) {
        socket.emit('leave_stream', { streamId });
        joinedStreamRef.current = null;
      }
    };
  }, [streamId, socket]);

  return { viewerCount };
}
