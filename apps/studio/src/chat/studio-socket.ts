import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth-store';
import { useChatStore, type ChatMessage } from '../store/chat-store';

const API_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  '';
if (!API_URL) console.error('[API] VITE_API_URL is not set! Chat socket will fail.');

let socket: Socket | null = null;
let currentStreamId: string | null = null;

export function connectChat(streamId: string): void {
  if (socket?.connected && currentStreamId === streamId) return;

  disconnectChat();
  currentStreamId = streamId;

  const { accessToken } = useAuthStore.getState();
  if (!accessToken) {
    console.warn('[StudioChat] No auth token, cannot connect');
    return;
  }

  socket = io(API_URL, {
    auth: { token: accessToken },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[StudioChat] Connected');
    useChatStore.getState().setConnected(true);
    socket!.emit('join_chat', { streamId });
  });

  socket.on('new_message', (msg: ChatMessage) => {
    useChatStore.getState().addMessage(msg);
  });

  socket.on('viewer_count', (data: { count: number }) => {
    useChatStore.getState().setViewerCount(data.count);
  });

  socket.on('disconnect', () => {
    console.log('[StudioChat] Disconnected');
    useChatStore.getState().setConnected(false);
  });

  socket.on('connect_error', (err) => {
    console.error('[StudioChat] Error:', err.message);
  });
}

export function sendMessage(streamId: string, content: string): void {
  if (!socket?.connected) return;
  socket.emit('send_message', { streamId, content });
}

export function disconnectChat(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentStreamId = null;
    useChatStore.getState().setConnected(false);
  }
}
