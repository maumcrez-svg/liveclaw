// ── OBS scene management helpers ────────────────────────────────────

import type { OBSConnection } from './connection';
import type { SourceItem } from './types';

const SCENE_NAME = 'LiveClaw';

/**
 * Create the "LiveClaw" scene if it doesn't exist and switch to it.
 */
export async function ensureScene(obs: OBSConnection): Promise<void> {
  try {
    const { scenes } = await obs.call<{ scenes: Array<{ sceneName: string }> }>(
      'GetSceneList',
    );

    const exists = scenes.some((s) => s.sceneName === SCENE_NAME);

    if (!exists) {
      await obs.call('CreateScene', { sceneName: SCENE_NAME });
    }

    await obs.call('SetCurrentProgramScene', { sceneName: SCENE_NAME });
  } catch (err: any) {
    console.error('[Scene] Failed to ensure scene:', err);
    throw new Error('Could not create the streaming scene in OBS. Try restarting OBS.');
  }
}

/**
 * Add a source to the LiveClaw scene.
 * Returns the sceneItemId assigned by OBS.
 */
export async function addSource(
  obs: OBSConnection,
  config: {
    inputName: string;
    inputKind: string;
    inputSettings?: Record<string, any>;
  },
): Promise<number> {
  try {
    const res = await obs.call<{ sceneItemId: number }>('CreateInput', {
      sceneName: SCENE_NAME,
      inputName: config.inputName,
      inputKind: config.inputKind,
      inputSettings: config.inputSettings ?? {},
    });

    return res.sceneItemId;
  } catch (err: any) {
    console.error('[Scene] Failed to add source:', err);
    throw new Error(`Could not add "${config.inputName}". This source type may not be available on your system.`);
  }
}

/**
 * Remove a source from the LiveClaw scene by sceneItemId.
 */
export async function removeSource(
  obs: OBSConnection,
  sceneItemId: number,
): Promise<void> {
  try {
    await obs.call('RemoveSceneItem', {
      sceneName: SCENE_NAME,
      sceneItemId,
    });
  } catch (err: any) {
    console.error('[Scene] Remove failed:', err);
    throw new Error('Could not remove this source. It may have already been deleted.');
  }
}

/**
 * Toggle visibility of a source in the LiveClaw scene.
 */
export async function toggleSource(
  obs: OBSConnection,
  sceneItemId: number,
  enabled: boolean,
): Promise<void> {
  try {
    await obs.call('SetSceneItemEnabled', {
      sceneName: SCENE_NAME,
      sceneItemId,
      sceneItemEnabled: enabled,
    });
  } catch {
    // Toggle failed — source may not exist
  }
}

/**
 * Reorder a source within the LiveClaw scene.
 */
export async function reorderSource(
  obs: OBSConnection,
  sceneItemId: number,
  newIndex: number,
): Promise<void> {
  try {
    await obs.call('SetSceneItemIndex', {
      sceneName: SCENE_NAME,
      sceneItemId,
      sceneItemIndex: newIndex,
    });
  } catch {
    // Reorder failed — source may not exist
  }
}

/**
 * List all sources in the LiveClaw scene.
 */
export async function listSources(obs: OBSConnection): Promise<SourceItem[]> {
  try {
    const res = await obs.call<{
      sceneItems: Array<{
        sceneItemId: number;
        sourceName: string;
        inputKind: string;
        sceneItemEnabled: boolean;
        sceneItemIndex: number;
      }>;
    }>('GetSceneItemList', { sceneName: SCENE_NAME });

    return res.sceneItems.map((item) => ({
      sceneItemId: item.sceneItemId,
      sourceName: item.sourceName,
      inputKind: item.inputKind,
      sceneItemEnabled: item.sceneItemEnabled,
      sceneItemIndex: item.sceneItemIndex,
    }));
  } catch {
    console.error('[Scene] Failed to list sources');
    return [];
  }
}

/**
 * Update the settings of an existing OBS input (overlay mode — merges with existing).
 */
export async function updateSourceSettings(
  obs: OBSConnection,
  inputName: string,
  settings: Record<string, unknown>,
): Promise<void> {
  try {
    await obs.call('SetInputSettings', {
      inputName,
      inputSettings: settings,
      overlay: true,
    });
  } catch (err: any) {
    console.error('[Scene] Failed to update source settings:', err);
    throw new Error(`Could not update settings for "${inputName}". The source may no longer exist.`);
  }
}

/**
 * Set the transform (position, scale, rotation, etc.) of a scene item.
 */
export async function setSourceTransform(
  obs: OBSConnection,
  sceneItemId: number,
  transform: Record<string, unknown>,
): Promise<void> {
  try {
    await obs.call('SetSceneItemTransform', {
      sceneName: SCENE_NAME,
      sceneItemId,
      sceneItemTransform: transform,
    });
  } catch {
    // Transform failed — source may have been deleted
  }
}

export async function getSourceTransform(
  obs: OBSConnection,
  sceneItemId: number,
): Promise<Record<string, unknown>> {
  try {
    const res = await obs.call<{ sceneItemTransform: Record<string, unknown> }>(
      'GetSceneItemTransform',
      { sceneName: SCENE_NAME, sceneItemId },
    );
    return res.sceneItemTransform;
  } catch {
    return { positionX: 0, positionY: 0, scaleX: 1, scaleY: 1, rotation: 0, sourceWidth: 1920, sourceHeight: 1080 };
  }
}

export async function getSourceScreenshot(
  obs: OBSConnection,
  sourceName: string,
  width = 160,
  height = 90,
): Promise<string> {
  const res = await obs.call<{ imageData: string }>(
    'GetSourceScreenshot',
    {
      sourceName,
      imageFormat: 'jpg',
      imageWidth: width,
      imageHeight: height,
      imageCompressionQuality: 60,
    },
  );
  return res.imageData;
}
