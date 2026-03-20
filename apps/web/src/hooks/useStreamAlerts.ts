'use client';

/**
 * useStreamAlerts
 *
 * A lightweight hook that connects to the Socket.IO server and listens for
 * `stream_alert` events for a given stream room. Uses `subscribe_alerts`
 * instead of `join_stream` so it does NOT inflate the viewer count.
 *
 * When streamId is null/undefined the hook does nothing and returns null.
 */

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { StreamAlert } from '@/lib/alerts';

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

export function useStreamAlerts(streamId: string | null | undefined): StreamAlert | null {
  const [lastAlert, setLastAlert] = useState<StreamAlert | null>(null);

  useEffect(() => {
    if (!streamId) return;

    const token = getAuthToken();
    const socket = io(WS_URL, {
      transports: ['websocket'],
      auth: token ? { token } : {},
    });

    socket.on('connect', () => {
      socket.emit('subscribe_alerts', { streamId });
    });

    socket.on('stream_alert', (alert: StreamAlert) => {
      setLastAlert(alert);
    });

    return () => {
      socket.emit('unsubscribe_alerts', { streamId });
      socket.disconnect();
    };
  }, [streamId]);

  return lastAlert;
}
