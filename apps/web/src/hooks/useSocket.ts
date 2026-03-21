'use client';

import { useEffect, useRef } from 'react';
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
 * Module-level singleton socket. All hooks in the same tab share this
 * single Socket.IO connection, reducing 4 sockets/tab → 1.
 */
let sharedSocket: Socket | null = null;
let refCount = 0;

function getOrCreateSocket(): Socket {
  if (sharedSocket && sharedSocket.connected) {
    return sharedSocket;
  }
  if (sharedSocket) {
    // Socket exists but disconnected — reuse instance, it will auto-reconnect
    return sharedSocket;
  }

  const token = getAuthToken();
  sharedSocket = io(WS_URL, {
    transports: ['websocket'],
    auth: token ? { token } : {},
  });

  return sharedSocket;
}

/**
 * Returns the shared Socket.IO connection for this tab.
 * Manages ref-counting so the socket is only destroyed when
 * the last consumer unmounts (e.g. full page navigation away).
 */
export function useSocket(): Socket {
  const socketRef = useRef<Socket | null>(null);

  if (!socketRef.current) {
    socketRef.current = getOrCreateSocket();
  }

  useEffect(() => {
    refCount++;
    return () => {
      refCount--;
      if (refCount <= 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
        refCount = 0;
      }
    };
  }, []);

  return socketRef.current;
}
