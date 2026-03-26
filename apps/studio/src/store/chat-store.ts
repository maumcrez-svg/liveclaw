import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  username: string;
  content: string;
  type: 'user' | 'agent' | 'system';
  createdAt: string;
}

interface ChatStoreState {
  messages: ChatMessage[];
  connected: boolean;
  viewerCount: number;
}

interface ChatStoreActions {
  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  setConnected: (connected: boolean) => void;
  setViewerCount: (count: number) => void;
  clear: () => void;
}

export const useChatStore = create<ChatStoreState & ChatStoreActions>((set) => ({
  messages: [],
  connected: false,
  viewerCount: 0,

  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages.slice(-199), msg],
    })),

  setMessages: (msgs) => set({ messages: msgs }),

  setConnected: (connected) => set({ connected }),

  setViewerCount: (count) => set({ viewerCount: count }),

  clear: () => set({ messages: [], connected: false, viewerCount: 0 }),
}));
