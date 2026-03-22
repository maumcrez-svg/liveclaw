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
    let active = true;
    let acked = false;

    const doJoin = () => {
      if (!active || acked || !socket.connected) return;
      console.info(`[Presence] join_stream emit → ${streamId} (socket: ${socket.id})`);
      socket.emit('join_stream', { streamId }, (response: any) => {
        if (!active) return;
        acked = true;
        // NestJS ACK returns raw object (no event wrapper)
        const count = response?.viewerCount ?? response?.data?.viewerCount;
        console.info(`[Presence] join_stream ACK ← count: ${count}`);
        if (count != null) {
          setViewerCount(count);
        }
      });
    };

    // On reconnect, server lost us — reset acked so we re-join
    const onDisconnect = () => {
      acked = false;
      console.info('[Presence] disconnected — will re-join on reconnect');
    };

    // Try immediately, on connect, and every 3s until ACK
    doJoin();
    socket.on('connect', doJoin);
    socket.on('disconnect', onDisconnect);
    const retryInterval = setInterval(() => {
      if (!acked) doJoin();
    }, 3000);

    // Listen for broadcast updates (other viewers joining/leaving)
    const onViewerCount = (data: { streamId: string; count: number }) => {
      if (data.streamId === streamId) {
        console.info(`[Presence] viewer_count event ← count: ${data.count}`);
        setViewerCount(data.count);
      }
    };
    socket.on('viewer_count', onViewerCount);

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (socket.connected) socket.emit('viewer_heartbeat');
    }, 30_000);

    return () => {
      active = false;
      clearInterval(retryInterval);
      clearInterval(heartbeat);
      socket.off('connect', doJoin);
      socket.off('disconnect', onDisconnect);
      socket.off('viewer_count', onViewerCount);
      if (acked) socket.emit('leave_stream', { streamId });
    };
  }, [streamId, socket]);

  return { viewerCount };
}
