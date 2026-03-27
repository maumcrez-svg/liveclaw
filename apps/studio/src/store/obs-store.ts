// ── OBS state store ─────────────────────────────────────────────────

import { create } from 'zustand';
import type { SourceItem } from '../obs/types';

interface OBSStoreState {
  connected: boolean;
  obsPath: string | null;
  obsPassword: string;
  sources: SourceItem[];
  streamActive: boolean;
  streamDuration: number;
  streamBytes: number;
  streamDroppedFrames: number;
  activeFps: number;
  outputSkippedFrames: number;
  reconnecting: boolean;
  reconnectAttempt: number;
  supportedInputKinds: string[];
}

interface OBSStoreActions {
  setConnected: (connected: boolean) => void;
  setObsPath: (path: string | null) => void;
  setObsPassword: (password: string) => void;
  setSources: (sources: SourceItem[]) => void;
  updateStreamStatus: (status: {
    active: boolean;
    duration: number;
    bytes: number;
    droppedFrames: number;
  }) => void;
  resetStream: () => void;
  setReconnecting: (reconnecting: boolean, attempt?: number) => void;
  setStats: (fps: number, skipped: number) => void;
  setSupportedInputKinds: (kinds: string[]) => void;
}

export const useOBSStore = create<OBSStoreState & OBSStoreActions>(
  (set) => ({
    connected: false,
    obsPath: null,
    obsPassword: '',
    sources: [],
    streamActive: false,
    streamDuration: 0,
    streamBytes: 0,
    streamDroppedFrames: 0,
    activeFps: 0,
    outputSkippedFrames: 0,
    reconnecting: false,
    reconnectAttempt: 0,
    supportedInputKinds: [],

    setConnected: (connected) => set({ connected }),

    setObsPath: (path) => set({ obsPath: path }),

    setObsPassword: (password) => set({ obsPassword: password }),

    setSources: (sources) => set({ sources }),

    updateStreamStatus: (status) =>
      set({
        streamActive: status.active,
        streamDuration: status.duration,
        streamBytes: status.bytes,
        streamDroppedFrames: status.droppedFrames,
      }),

    resetStream: () =>
      set({
        streamActive: false,
        streamDuration: 0,
        streamBytes: 0,
        streamDroppedFrames: 0,
      }),

    setReconnecting: (reconnecting, attempt) => set({ reconnecting, reconnectAttempt: attempt ?? 0 }),

    setStats: (fps, skipped) => set({ activeFps: fps, outputSkippedFrames: skipped }),

    setSupportedInputKinds: (kinds) => set({ supportedInputKinds: kinds }),
  }),
);
