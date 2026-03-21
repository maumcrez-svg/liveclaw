'use client';

import { useEffect, useState } from 'react';
import { useSocket } from './useSocket';

/**
 * Dedicated viewer presence hook — decoupled from chat.
 * Uses the shared singleton socket. Emits join_stream + heartbeat, tracks viewer count.
 * Call at the page level so every viewer is counted regardless of chat visibility.
 */
export function useViewerPresence(streamId: string | null) {
  const [viewerCount, setViewerCount] = useState(0);
  const socket = useSocket();

  useEffect(() => {
    if (!streamId) return;

    const onConnect = () => {
      console.info(`[Presence] Connected, joining stream ${streamId}`);
      socket.emit('join_stream', { streamId });
    };

    const onViewerCount = (data: { streamId: string; count: number }) => {
      if (data.streamId === streamId) {
        setViewerCount(data.count);
      }
    };

    // If already connected, join immediately
    if (socket.connected) {
      onConnect();
    }
    socket.on('connect', onConnect);
    socket.on('viewer_count', onViewerCount);

    // Heartbeat: tell server this viewer is still actively watching
    const heartbeat = setInterval(() => {
      if (socket.connected) {
        socket.emit('viewer_heartbeat');
      }
    }, 30_000);

    return () => {
      clearInterval(heartbeat);
      socket.off('connect', onConnect);
      socket.off('viewer_count', onViewerCount);
      // Leave stream instead of disconnecting — socket is shared
      socket.emit('leave_stream', { streamId });
    };
  }, [streamId, socket]);

  return { viewerCount };
}
