// ── OBS scene management helpers ────────────────────────────────────

import type { OBSConnection } from './connection';
import type { SourceItem } from './types';

const SCENE_NAME = 'LiveClaw';

/**
 * Create the "LiveClaw" scene if it doesn't exist and switch to it.
 */
export async function ensureScene(obs: OBSConnection): Promise<void> {
  const { scenes } = await obs.call<{ scenes: Array<{ sceneName: string }> }>(
    'GetSceneList',
  );

  const exists = scenes.some((s) => s.sceneName === SCENE_NAME);

  if (!exists) {
    await obs.call('CreateScene', { sceneName: SCENE_NAME });
  }

  await obs.call('SetCurrentProgramScene', { sceneName: SCENE_NAME });
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
  const res = await obs.call<{ sceneItemId: number }>('CreateInput', {
    sceneName: SCENE_NAME,
    inputName: config.inputName,
    inputKind: config.inputKind,
    inputSettings: config.inputSettings ?? {},
  });

  return res.sceneItemId;
}

/**
 * Remove a source from the LiveClaw scene by sceneItemId.
 */
export async function removeSource(
  obs: OBSConnection,
  sceneItemId: number,
): Promise<void> {
  await obs.call('RemoveSceneItem', {
    sceneName: SCENE_NAME,
    sceneItemId,
  });
}

/**
 * Toggle visibility of a source in the LiveClaw scene.
 */
export async function toggleSource(
  obs: OBSConnection,
  sceneItemId: number,
  enabled: boolean,
): Promise<void> {
  await obs.call('SetSceneItemEnabled', {
    sceneName: SCENE_NAME,
    sceneItemId,
    sceneItemEnabled: enabled,
  });
}

/**
 * Reorder a source within the LiveClaw scene.
 */
export async function reorderSource(
  obs: OBSConnection,
  sceneItemId: number,
  newIndex: number,
): Promise<void> {
  await obs.call('SetSceneItemIndex', {
    sceneName: SCENE_NAME,
    sceneItemId,
    sceneItemIndex: newIndex,
  });
}

/**
 * List all sources in the LiveClaw scene.
 */
export async function listSources(obs: OBSConnection): Promise<SourceItem[]> {
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
}

/**
 * Update the settings of an existing OBS input (overlay mode — merges with existing).
 */
export async function updateSourceSettings(
  obs: OBSConnection,
  inputName: string,
  settings: Record<string, unknown>,
): Promise<void> {
  await obs.call('SetInputSettings', {
    inputName,
    inputSettings: settings,
    overlay: true,
  });
}

/**
 * Set the transform (position, scale, rotation, etc.) of a scene item.
 */
export async function setSourceTransform(
  obs: OBSConnection,
  sceneItemId: number,
  transform: Record<string, unknown>,
): Promise<void> {
  await obs.call('SetSceneItemTransform', {
    sceneName: SCENE_NAME,
    sceneItemId,
    sceneItemTransform: transform,
  });
}

export async function getSourceTransform(
  obs: OBSConnection,
  sceneItemId: number,
): Promise<Record<string, unknown>> {
  const res = await obs.call<{ sceneItemTransform: Record<string, unknown> }>(
    'GetSceneItemTransform',
    { sceneName: SCENE_NAME, sceneItemId },
  );
  return res.sceneItemTransform;
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
