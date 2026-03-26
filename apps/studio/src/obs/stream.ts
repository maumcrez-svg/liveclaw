// ── OBS stream configuration helpers ────────────────────────────────

import type { OBSConnection } from './connection';
import type { StreamStatus, VideoSettings } from './types';

/**
 * Set the RTMP stream server + key on OBS.
 */
export async function configureStream(
  obs: OBSConnection,
  rtmpUrl: string,
  streamKey: string,
): Promise<void> {
  await obs.call('SetStreamServiceSettings', {
    streamServiceType: 'rtmp_custom',
    streamServiceSettings: {
      server: rtmpUrl,
      key: streamKey,
    },
  });
}

/**
 * Apply video resolution and framerate settings.
 * Accepts a resolution string like "1920x1080".
 */
export async function applyVideoSettings(
  obs: OBSConnection,
  settings: VideoSettings,
): Promise<void> {
  const [widthStr, heightStr] = settings.resolution.split('x');
  const width = parseInt(widthStr, 10);
  const height = parseInt(heightStr, 10);

  if (isNaN(width) || isNaN(height)) {
    throw new Error(`Invalid resolution format: ${settings.resolution}`);
  }

  await obs.call('SetVideoSettings', {
    baseWidth: width,
    baseHeight: height,
    outputWidth: width,
    outputHeight: height,
    fpsNumerator: settings.fps,
    fpsDenominator: 1,
  });
}

/**
 * Start the OBS stream output.
 */
export async function startStream(obs: OBSConnection): Promise<void> {
  await obs.call('StartStream');
}

/**
 * Stop the OBS stream output.
 */
export async function stopStream(obs: OBSConnection): Promise<void> {
  await obs.call('StopStream');
}

/**
 * Poll current stream status from OBS.
 */
export async function getStreamStatus(
  obs: OBSConnection,
): Promise<StreamStatus> {
  const res = await obs.call<{
    outputActive: boolean;
    outputBytes: number;
    outputDuration: number;
    outputSkippedFrames: number;
  }>('GetStreamStatus');

  return {
    active: res.outputActive,
    bytes: res.outputBytes,
    duration: res.outputDuration,
    droppedFrames: res.outputSkippedFrames,
  };
}

/**
 * Start OBS Virtual Camera output.
 */
export async function startVirtualCam(obs: OBSConnection): Promise<void> {
  await obs.call('StartVirtualCam');
}

/**
 * Stop OBS Virtual Camera output.
 */
export async function stopVirtualCam(obs: OBSConnection): Promise<void> {
  await obs.call('StopVirtualCam');
}

/**
 * Check whether the OBS Virtual Camera is currently active.
 */
export async function getVirtualCamStatus(obs: OBSConnection): Promise<boolean> {
  const res = await obs.call<{ outputActive: boolean }>('GetVirtualCamStatus');
  return res.outputActive;
}

export async function startRecord(obs: OBSConnection): Promise<void> {
  await obs.call('StartRecord');
}

export async function stopRecord(obs: OBSConnection): Promise<void> {
  await obs.call('StopRecord');
}

export async function getRecordStatus(obs: OBSConnection): Promise<{ active: boolean; duration: number }> {
  const res = await obs.call<{ outputActive: boolean; outputDuration: number }>('GetRecordStatus');
  return { active: res.outputActive, duration: res.outputDuration };
}

export async function setInputVolume(obs: OBSConnection, inputName: string, volume: number): Promise<void> {
  await obs.call('SetInputVolume', { inputName, inputVolumeMultiplier: volume });
}

export async function setInputMute(obs: OBSConnection, inputName: string, muted: boolean): Promise<void> {
  await obs.call('SetInputMute', { inputName, inputMuted: muted });
}
