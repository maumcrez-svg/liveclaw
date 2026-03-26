import type { OBSConnection } from './connection';

export interface FilterInfo {
  filterName: string;
  filterKind: string;
  filterIndex: number;
  filterEnabled: boolean;
  filterSettings: Record<string, unknown>;
}

export async function listFilters(
  obs: OBSConnection,
  sourceName: string,
): Promise<FilterInfo[]> {
  const res = await obs.call<{ filters: FilterInfo[] }>(
    'GetSourceFilterList',
    { sourceName },
  );
  return res.filters;
}

export async function addFilter(
  obs: OBSConnection,
  sourceName: string,
  filterName: string,
  filterKind: string,
  filterSettings: Record<string, unknown> = {},
): Promise<void> {
  await obs.call('CreateSourceFilter', {
    sourceName,
    filterName,
    filterKind,
    filterSettings,
  });
}

export async function removeFilter(
  obs: OBSConnection,
  sourceName: string,
  filterName: string,
): Promise<void> {
  await obs.call('RemoveSourceFilter', { sourceName, filterName });
}

export async function updateFilterSettings(
  obs: OBSConnection,
  sourceName: string,
  filterName: string,
  filterSettings: Record<string, unknown>,
): Promise<void> {
  await obs.call('SetSourceFilterSettings', {
    sourceName,
    filterName,
    filterSettings,
    overlay: true,
  });
}

export async function toggleFilter(
  obs: OBSConnection,
  sourceName: string,
  filterName: string,
  enabled: boolean,
): Promise<void> {
  await obs.call('SetSourceFilterEnabled', {
    sourceName,
    filterName,
    filterEnabled: enabled,
  });
}

// ── Quick filter presets ────────────────────────────────────────

export const FILTER_PRESETS = [
  {
    id: 'blur',
    label: 'Blur',
    emoji: '\u{1F32B}\u{FE0F}',
    filterKind: 'blur_filter_v2',
    defaultSettings: { type: 'gaussian', size: 10 },
  },
  {
    id: 'sharpen',
    label: 'Sharpen',
    emoji: '\u{1F4A0}',
    filterKind: 'sharpen_filter_v2',
    defaultSettings: { sharpness: 0.5 },
  },
  {
    id: 'chroma_key',
    label: 'Green Screen',
    emoji: '\u{1F7E9}',
    filterKind: 'chroma_key_filter',
    defaultSettings: { key_color_type: 'green', similarity: 400 },
  },
  {
    id: 'color',
    label: 'Color Tint',
    emoji: '\u{1F3A8}',
    filterKind: 'color_filter_v2',
    defaultSettings: { brightness: 0, contrast: 0, gamma: 0, hue_shift: 0, opacity: 100, saturation: 0 },
  },
] as const;
