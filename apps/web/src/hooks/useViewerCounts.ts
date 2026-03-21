'use client';

import { useEffect, useState } from 'react';
import { useSocket } from './useSocket';

/**
 * Global real-time viewer counts for all live streams.
 * Uses the shared singleton socket and subscribes to viewer_count_update events.
 * Returns a Map<agentId, viewerCount> that updates in real-time.
 */
export function useViewerCounts(): Map<string, number> {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const socket = useSocket();

  useEffect(() => {
    let subscribed = false;

    const doSubscribe = () => {
      if (subscribed) return;
      subscribed = true;
      console.info('[ViewerCounts] Subscribing to counts');
      socket.emit('subscribe_counts');
    };

    const onSnapshot = (entries: Array<{ agentId: string; count: number }>) => {
      setCounts(() => {
        const next = new Map<string, number>();
        for (const e of entries) {
          if (e.count > 0) next.set(e.agentId, e.count);
        }
        return next;
      });
    };

    const onUpdate = (data: { agentId: string; count: number }) => {
      setCounts((prev) => {
        const next = new Map(prev);
        if (data.count > 0) {
          next.set(data.agentId, data.count);
        } else {
          next.delete(data.agentId);
        }
        return next;
      });
    };

    if (socket.connected) {
      doSubscribe();
    }
    socket.on('connect', doSubscribe);
    socket.on('viewer_count_snapshot', onSnapshot);
    socket.on('viewer_count_update', onUpdate);

    // Retry in case socket is mid-handshake
    const retryTimer = setTimeout(doSubscribe, 500);

    return () => {
      clearTimeout(retryTimer);
      socket.off('connect', doSubscribe);
      socket.off('viewer_count_snapshot', onSnapshot);
      socket.off('viewer_count_update', onUpdate);
    };
  }, [socket]);

  return counts;
}
