// ── Scene templates ─────────────────────────────────────────────────
//
// Pre-built scene layouts. User picks a template instead of manually
// adding sources one by one. Each template defines which sources to
// create and their approximate positions.

import type { OBSConnection } from './connection';
import { addSource, ensureScene, listSources } from './scene';
import { SOURCE_TYPES, resolveInputKind, getAllCandidates } from './sources';
import { useOBSStore } from '../store/obs-store';

// Template thumbnails
import thumbFullscreen from '../assets/template-fullscreen.png';
import thumbScreenWebcam from '../assets/template-screen-webcam.png';
import thumbBrowser from '../assets/template-browser.png';
import thumbWindow from '../assets/template-window.png';

export interface SceneTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  thumbnail?: string;
  sources: TemplateSources[];
}

interface TemplateSources {
  inputName: string;
  sourceTypeId: string; // matches SOURCE_TYPES[].id
  settings?: Record<string, any>;
}

function getInputKind(sourceTypeId: string): string | null {
  const supportedKinds = useOBSStore.getState().supportedInputKinds;
  // Try dynamic resolution first, fall back to static hint
  const resolved = resolveInputKind(sourceTypeId as any, supportedKinds);
  if (resolved) return resolved;
  const st = SOURCE_TYPES.find((s) => s.id === sourceTypeId);
  return st?.obsInputKind ?? null;
}

export const SCENE_TEMPLATES: SceneTemplate[] = [
  {
    id: 'fullscreen',
    name: 'Full Screen',
    description: 'Captures your entire screen. Simple and clean.',
    icon: '\u{1F5A5}',
    thumbnail: thumbFullscreen,
    sources: [
      { inputName: 'Display Capture', sourceTypeId: 'display' },
    ],
  },
  {
    id: 'screen-webcam',
    name: 'Screen + Webcam',
    description: 'Screen capture with a webcam overlay in the corner.',
    icon: '\u{1F4F7}',
    thumbnail: thumbScreenWebcam,
    sources: [
      { inputName: 'Display Capture', sourceTypeId: 'display' },
      { inputName: 'Webcam', sourceTypeId: 'webcam' },
    ],
  },
  {
    id: 'browser-kiosk',
    name: 'Browser Kiosk',
    description: 'A full-screen web page. Great for dashboards and web apps.',
    icon: '\u{1F310}',
    thumbnail: thumbBrowser,
    sources: [
      {
        inputName: 'Browser',
        sourceTypeId: 'browser',
        settings: { url: 'about:blank', width: 1920, height: 1080 },
      },
    ],
  },
  {
    id: 'window-focus',
    name: 'Window Focus',
    description: 'Captures a specific window. Keeps other apps private.',
    icon: '\u{1F5D4}',
    thumbnail: thumbWindow,
    sources: [
      { inputName: 'Window Capture', sourceTypeId: 'window' },
    ],
  },
];

/**
 * Apply a scene template: ensures the LiveClaw scene exists, clears existing
 * sources, then creates all template sources in order.
 */
export async function applySceneTemplate(
  obs: OBSConnection,
  template: SceneTemplate,
): Promise<void> {
  await ensureScene(obs);

  // Remove existing sources
  const existing = await listSources(obs);
  for (const item of existing) {
    try {
      await obs.call('RemoveSceneItem', {
        sceneName: 'LiveClaw',
        sceneItemId: item.sceneItemId,
      });
    } catch {
      // Source may have been removed already
    }
  }

  // Add template sources — try each with fallback kinds
  const supportedKinds = useOBSStore.getState().supportedInputKinds;
  for (const src of template.sources) {
    const sourceType = SOURCE_TYPES.find((s) => s.id === src.sourceTypeId);
    const settings = { ...(sourceType?.defaultSettings ?? {}), ...(src.settings ?? {}) };
    const uniqueName = `${src.inputName} ${Date.now().toString(36).slice(-4)}`;

    // Get candidates: resolved first, then brute force from sources.ts
    const resolved = resolveInputKind(src.sourceTypeId as any, supportedKinds);
    const candidates: string[] = resolved ? [resolved] : getAllCandidates(src.sourceTypeId as any);

    let added = false;
    for (const kind of candidates) {
      try {
        await addSource(obs, { inputName: uniqueName, inputKind: kind, inputSettings: settings });
        added = true;
        break;
      } catch {
        // This kind didn't work, try next
      }
    }

    if (!added) {
      console.warn(`[Template] Could not add ${src.sourceTypeId} source — no supported kind found`);
    }
  }

  // After creating all sources, apply positioning for multi-source templates
  if (template.id === 'screen-webcam') {
    const items = await listSources(obs);
    const webcamItem = items.find((s) => s.sourceName === 'Webcam');
    if (webcamItem) {
      await obs.call('SetSceneItemTransform', {
        sceneName: 'LiveClaw',
        sceneItemId: webcamItem.sceneItemId,
        sceneItemTransform: {
          positionX: 1400,
          positionY: 750,
          scaleX: 0.3,
          scaleY: 0.3,
        },
      });
    }
  }
}
