'use client';

/**
 * useStreamAlerts
 *
 * Listens for `stream_alert` events for a given stream room using the shared
 * singleton socket. Uses `subscribe_alerts` instead of `join_stream` so it
 * does NOT inflate the viewer count.
 *
 * When streamId is null/undefined the hook does nothing and returns null.
 */

import { useEffect, useState } from 'react';
import { StreamAlert } from '@/lib/alerts';
import { useSocket } from './useSocket';

export function useStreamAlerts(streamId: string | null | undefined): StreamAlert | null {
  const [lastAlert, setLastAlert] = useState<StreamAlert | null>(null);
  const socket = useSocket();

  useEffect(() => {
    if (!streamId) return;

    const onConnect = () => {
      socket.emit('subscribe_alerts', { streamId });
    };

    const onStreamAlert = (alert: StreamAlert) => {
      setLastAlert(alert);
    };

    // If already connected, subscribe immediately
    if (socket.connected) {
      onConnect();
    }
    socket.on('connect', onConnect);
    socket.on('stream_alert', onStreamAlert);

    return () => {
      socket.off('connect', onConnect);
      socket.off('stream_alert', onStreamAlert);
      socket.emit('unsubscribe_alerts', { streamId });
    };
  }, [streamId, socket]);

  return lastAlert;
}
