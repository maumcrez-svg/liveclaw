// ── Platform-aware OBS source type definitions ─────────────────────
//
// Maps human-friendly source types to the correct OBS inputKind per OS.

export interface SourceTypeConfig {
  id: string;
  label: string;
  icon: string;
  obsInputKind: string;
  defaultSettings: Record<string, any>;
  configFields: ConfigField[];
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'file';
  placeholder?: string;
  defaultValue?: string | number;
}

// ── platform detection ──────────────────────────────────────────────

type Platform = 'win' | 'mac' | 'linux';

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'win';
  if (ua.includes('mac')) return 'mac';
  return 'linux';
}

const platform = detectPlatform();

// ── source type registry ────────────────────────────────────────────

// Detect X11 vs Wayland on Linux
function isWayland(): boolean {
  if (typeof navigator === 'undefined') return false;
  // XDG_SESSION_TYPE would be 'wayland' on Wayland, but we can't access env from browser.
  // Heuristic: if navigator.userAgent doesn't help, default to X11 (safer, no permission dialog)
  return false; // Default to X11 — xshm works without permission dialogs
}

const displayCaptureKind: Record<Platform, string> = {
  win: 'monitor_capture',
  mac: 'display_capture',
  linux: isWayland() ? 'pipewire-desktop-capture-source' : 'xshm_input',
};

const webcamKind: Record<Platform, string> = {
  win: 'dshow_input',
  mac: 'av_capture_input_v2',
  linux: 'v4l2_input',
};

export const SOURCE_TYPES: SourceTypeConfig[] = [
  {
    id: 'display',
    label: 'Display Capture',
    icon: '\uD83D\uDDA5',
    obsInputKind: displayCaptureKind[platform],
    defaultSettings: {},
    configFields: [],
  },
  {
    id: 'window',
    label: 'Window Capture',
    icon: '\uD83D\uDD33',
    obsInputKind: 'window_capture',
    defaultSettings: {},
    configFields: [],
  },
  {
    id: 'webcam',
    label: 'Webcam',
    icon: '\uD83D\uDCF7',
    obsInputKind: webcamKind[platform],
    defaultSettings: {},
    configFields: [],
  },
  {
    id: 'browser',
    label: 'Browser Source',
    icon: '\uD83C\uDF10',
    obsInputKind: 'browser_source',
    defaultSettings: {
      width: 1920,
      height: 1080,
      fps: 30,
    },
    configFields: [
      {
        key: 'url',
        label: 'URL',
        type: 'text',
        placeholder: 'https://example.com',
      },
    ],
  },
  {
    id: 'image',
    label: 'Image',
    icon: '\uD83D\uDDBC',
    obsInputKind: 'image_source',
    defaultSettings: {},
    configFields: [
      {
        key: 'file',
        label: 'File Path',
        type: 'text',
        placeholder: '/path/to/image.png',
      },
    ],
  },
  {
    id: 'text',
    label: 'Text',
    icon: '\u270F\uFE0F',
    obsInputKind: 'text_ft2_source_v2',
    defaultSettings: {
      text: 'Hello World',
      font: { face: 'Sans Serif', size: 64, style: '', flags: 0 },
      color1: 4294967295,
      color2: 4294967295,
    },
    configFields: [
      {
        key: 'text',
        label: 'Text content',
        type: 'text',
        defaultValue: 'Hello World',
      },
    ],
  },
];

/**
 * Look up the icon emoji for a given OBS inputKind.
 * Falls back to a generic icon if unknown.
 */
export function iconForInputKind(inputKind: string): string {
  const match = SOURCE_TYPES.find((s) => s.obsInputKind === inputKind);
  return match?.icon ?? '\u2B1C';
}

/**
 * Look up a friendly label for a given OBS inputKind.
 */
export function labelForInputKind(inputKind: string): string {
  const match = SOURCE_TYPES.find((s) => s.obsInputKind === inputKind);
  return match?.label ?? inputKind;
}

/**
 * Get the default Display Capture source config for the current platform.
 * Used for auto-adding a source when the scene is empty.
 */
export function getDefaultDisplaySource(): { label: string; obsInputKind: string; defaultSettings: Record<string, any> } {
  return {
    label: 'Display Capture',
    obsInputKind: displayCaptureKind[platform],
    defaultSettings: {},
  };
}
