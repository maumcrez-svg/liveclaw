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
    let joinEmitted = false;
    let joining = false;

    const doJoin = () => {
      if (!active || acked || joining || !socket.connected) return;
      joining = true;
      joinEmitted = true;
      console.info(`[Presence] join_stream emit → ${streamId} (socket: ${socket.id})`);
      socket.emit('join_stream', { streamId }, (response: any) => {
        joining = false;
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
      joinEmitted = false;
      console.info('[Presence] disconnected — will re-join on reconnect');
    };

    // Register connect listener FIRST, then try immediately
    socket.on('connect', doJoin);
    socket.on('disconnect', onDisconnect);
    doJoin();

    // Retry: fast first attempts, then slow down
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    const scheduleRetry = () => {
      if (acked || !active) return;
      const delay = retryCount < 5 ? 500 : 3000;
      retryTimer = setTimeout(() => {
        retryCount++;
        doJoin();
        scheduleRetry();
      }, delay);
    };
    scheduleRetry();

    // Listen for broadcast updates (other viewers joining/leaving)
    const onViewerCount = (data: { streamId: string; count: number }) => {
      if (data.streamId === streamId) {
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
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(heartbeat);
      socket.off('connect', doJoin);
      socket.off('disconnect', onDisconnect);
      socket.off('viewer_count', onViewerCount);
      // ALWAYS emit leave if join was sent — Socket.IO preserves order
      if (joinEmitted && socket.connected) {
        socket.emit('leave_stream', { streamId });
      }
    };
  }, [streamId, socket]);

  return { viewerCount };
}
