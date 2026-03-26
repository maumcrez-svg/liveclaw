// ── OBS WebSocket types ─────────────────────────────────────────────

export type OBSConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'auth_required'
  | 'error';

export interface SourceItem {
  sceneItemId: number;
  sourceName: string;
  inputKind: string;
  sceneItemEnabled: boolean;
  sceneItemIndex: number;
}

export interface StreamStatus {
  active: boolean;
  bytes: number;
  duration: number;
  droppedFrames: number;
}

export interface VideoSettings {
  resolution: string; // e.g. "1920x1080"
  fps: number;
}
