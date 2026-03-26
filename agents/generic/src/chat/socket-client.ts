import { io, Socket } from 'socket.io-client';
import { env, getAgentConfig } from '../config';

export interface ChatMessage {
  id: string;
  username: string;
  content: string;
  type: string;
  userId?: string;
  isAgent?: boolean;
  streamId?: string;
}

type MessageHandler = (msg: ChatMessage) => void;

let socket: Socket | null = null;
let handler: MessageHandler | null = null;
let streamId: string | null = null;

export function onMessage(fn: MessageHandler): void {
  handler = fn;
}

export async function startSocket(): Promise<void> {
  const sid = await fetchStreamId();
  if (!sid) {
    console.warn('[Socket] No active stream found');
    return;
  }
  streamId = sid;
  console.log(`[Socket] Stream ID: ${streamId}`);

  const config = getAgentConfig();

  socket = io(env.apiBaseUrl, {
    auth: { token: env.agentApiKey },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: Infinity,
  });

  socket.on('connect', () => {
    console.log(`[Socket] Connected: ${socket!.id}`);
    socket!.emit('join_stream', { streamId }, (res: any) => {
      console.log('[Socket] Joined stream:', JSON.stringify(res));
    });
  });

  socket.on('new_message', (msg: ChatMessage) => {
    if (msg.isAgent || msg.type === 'agent') return;
    if (msg.userId === env.agentId) return;
    if (msg.username === config.slug) return;
    handler?.(msg);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Disconnected: ${reason}`);
  });

  socket.on('connect_error', (err) => {
    console.error(`[Socket] Error: ${err.message}`);
  });
}

export function stopSocket(): void {
  socket?.disconnect();
  socket = null;
}

async function fetchStreamId(): Promise<string | null> {
  try {
    const res = await fetch(`${env.apiBaseUrl}/streams/live`);
    if (!res.ok) return null;
    const streams = await res.json() as any[];
    const mine = streams.find((s: any) => s.agentId === env.agentId);
    if (mine) return mine.id;

    // Fallback: try chat messages
    const chatRes = await fetch(`${env.apiBaseUrl}/chat/${env.agentId}/messages?limit=1`);
    if (!chatRes.ok) return null;
    const msgs = await chatRes.json() as any[];
    return msgs[0]?.streamId || null;
  } catch (err) {
    console.error('[Socket] fetchStreamId failed:', err);
    return null;
  }
}
