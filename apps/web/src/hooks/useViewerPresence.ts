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

    let joined = false;

    const doJoin = () => {
      if (joined) return;
      joined = true;
      console.info(`[Presence] Joining stream ${streamId}`);
      socket.emit('join_stream', { streamId });
    };

    const onViewerCount = (data: { streamId: string; count: number }) => {
      if (data.streamId === streamId) {
        setViewerCount(data.count);
      }
    };

    // Join immediately if connected, otherwise wait for connect event
    if (socket.connected) {
      doJoin();
    }
    socket.on('connect', doJoin);
    socket.on('viewer_count', onViewerCount);

    // Safety net: if socket is mid-handshake, retry after a short delay
    const retryTimer = setTimeout(() => {
      if (socket.connected && !joined) {
        doJoin();
      }
    }, 1000);

    // Heartbeat: tell server this viewer is still actively watching
    const heartbeat = setInterval(() => {
      if (socket.connected) {
        socket.emit('viewer_heartbeat');
      }
    }, 30_000);

    return () => {
      clearTimeout(retryTimer);
      clearInterval(heartbeat);
      socket.off('connect', doJoin);
      socket.off('viewer_count', onViewerCount);
      // Leave stream instead of disconnecting — socket is shared
      if (joined) {
        socket.emit('leave_stream', { streamId });
      }
    };
  }, [streamId, socket]);

  return { viewerCount };
}
