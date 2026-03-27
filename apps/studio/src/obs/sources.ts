// ── OBS source type definitions ─────────────────────────────────────
//
// Dynamic input kind resolution. Instead of guessing the platform and
// hardcoding OBS source names, we query OBS for its GetInputKindList
// on connect and pick the first supported kind from a priority list.

export interface SourceTypeConfig {
  id: string;
  label: string;
  icon: string;
  obsInputKind: string; // static hint — use resolveInputKind() at runtime
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

// ── candidate kinds per category (priority order) ───────────────────

const DISPLAY_KINDS = ['screen_capture', 'monitor_capture', 'display_capture', 'xshm_input', 'pipewire-desktop-capture-source'];
const WEBCAM_KINDS = ['v4l2_input', 'dshow_input', 'av_capture_input_v2', 'av_capture_input'];
const WINDOW_KINDS = ['window_capture', 'xcomposite_input'];
const TEXT_KINDS = ['text_ft2_source_v2', 'text_ft2_source', 'text_gdiplus_v3', 'text_gdiplus_v2'];

// ── dynamic resolution ──────────────────────────────────────────────

type SourceCategory = 'display' | 'webcam' | 'window' | 'text' | 'browser' | 'image';

const CANDIDATES: Record<SourceCategory, string[]> = {
  display: DISPLAY_KINDS,
  webcam: WEBCAM_KINDS,
  window: WINDOW_KINDS,
  text: TEXT_KINDS,
  browser: ['browser_source'],
  image: ['image_source'],
};

/**
 * Pick the best OBS inputKind for a category from the list of kinds
 * that OBS actually supports. Returns null if none are available.
 */
export function resolveInputKind(category: SourceCategory, supportedKinds: string[]): string | null {
  const kinds = CANDIDATES[category] || [];
  return kinds.find((k) => supportedKinds.includes(k)) || null;
}

/**
 * Returns all display capture kinds that OBS supports, in priority order.
 * If supportedKinds is empty (detection not done yet), returns the full
 * candidate list as a fallback.
 */
export function getDisplayCaptureFallbacks(supportedKinds?: string[]): string[] {
  if (supportedKinds && supportedKinds.length > 0) {
    return DISPLAY_KINDS.filter((k) => supportedKinds.includes(k));
  }
  return DISPLAY_KINDS; // fallback to all if detection not done yet
}

/**
 * Get the best display capture source for auto-adding.
 * Returns null when no display capture kind is available.
 */
export function getDefaultDisplaySource(supportedKinds: string[]): { label: string; obsInputKind: string; defaultSettings: Record<string, any> } | null {
  const kind = resolveInputKind('display', supportedKinds);
  if (!kind) return null;
  return { label: 'Display Capture', obsInputKind: kind, defaultSettings: {} };
}

// ── source type registry ────────────────────────────────────────────
//
// obsInputKind here is a static hint used for icon/label lookups and
// the AddSourceModal. Callers that create sources should prefer
// resolveInputKind() to pick the right kind at runtime.

export const SOURCE_TYPES: SourceTypeConfig[] = [
  {
    id: 'display',
    label: 'Display Capture',
    icon: '\uD83D\uDDA5',
    obsInputKind: 'monitor_capture',
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
    obsInputKind: 'v4l2_input',
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

// ── category for an OBS inputKind ───────────────────────────────────

/**
 * Determine which category an OBS inputKind belongs to.
 * Used for icon/label lookups on sources that already exist.
 */
function categoryForKind(inputKind: string): SourceCategory | null {
  for (const [cat, kinds] of Object.entries(CANDIDATES)) {
    if (kinds.includes(inputKind)) return cat as SourceCategory;
  }
  return null;
}

/**
 * Look up the icon emoji for a given OBS inputKind.
 * Falls back to a generic icon if unknown.
 */
export function iconForInputKind(inputKind: string): string {
  // Direct match on SOURCE_TYPES
  const direct = SOURCE_TYPES.find((s) => s.obsInputKind === inputKind);
  if (direct) return direct.icon;
  // Category-based match (e.g. pipewire source -> display icon)
  const cat = categoryForKind(inputKind);
  if (cat) {
    const st = SOURCE_TYPES.find((s) => s.id === cat);
    if (st) return st.icon;
  }
  return '\u2B1C';
}

/**
 * Look up a friendly label for a given OBS inputKind.
 */
export function labelForInputKind(inputKind: string): string {
  const direct = SOURCE_TYPES.find((s) => s.obsInputKind === inputKind);
  if (direct) return direct.label;
  const cat = categoryForKind(inputKind);
  if (cat) {
    const st = SOURCE_TYPES.find((s) => s.id === cat);
    if (st) return st.label;
  }
  return inputKind;
}
