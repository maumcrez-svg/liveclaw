import React, { useEffect, useRef, useState } from 'react';
import { useOBSStore } from '../store/obs-store';
import { getOBS } from '../obs/connection';
import { toggleSource, reorderSource, listSources, getSourceScreenshot } from '../obs/scene';

interface SourceListProps {
  onSourceSelect?: (sourceName: string, sceneItemId: number) => void;
  selectedSource?: string | null;
}

function friendlyName(inputKind: string): string {
  const map: Record<string, string> = {
    xshm_input: 'Screen',
    monitor_capture: 'Screen',
    display_capture: 'Screen',
    pipewire_desktop_capture_source: 'Screen',
    window_capture: 'Window',
    xcomposite_input: 'Window',
    v4l2_input: 'Webcam',
    dshow_input: 'Webcam',
    av_capture_input_v2: 'Webcam',
    browser_source: 'Browser',
    image_source: 'Image',
    text_ft2_source_v2: 'Text',
    text_gdiplus_v3: 'Text',
  };
  return map[inputKind] || 'Source';
}

function kindEmoji(inputKind: string): string {
  const f = friendlyName(inputKind);
  const map: Record<string, string> = {
    Screen: '\u{1F5A5}\u{FE0F}',
    Window: '\u{1FA9F}',
    Webcam: '\u{1F4F7}',
    Browser: '\u{1F310}',
    Image: '\u{1F5BC}\u{FE0F}',
    Text: '\u{270F}\u{FE0F}',
    Source: '\u{1F4E6}',
  };
  return map[f] || '\u{1F4E6}';
}

export function SourceList({ onSourceSelect, selectedSource }: SourceListProps) {
  const sources = useOBSStore((s) => s.sources);
  const setSources = useOBSStore((s) => s.setSources);
  const connected = useOBSStore((s) => s.connected);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const thumbTimerRef = useRef<ReturnType<typeof setInterval>>();

  // Poll thumbnails every 3s
  useEffect(() => {
    if (!connected || sources.length === 0) return;

    const fetchThumbs = async () => {
      const obs = getOBS();
      const newThumbs: Record<string, string> = {};
      for (const src of sources) {
        if (!src.sceneItemEnabled) continue;
        try {
          newThumbs[src.sourceName] = await getSourceScreenshot(obs, src.sourceName);
        } catch {
          // source might not support screenshots
        }
      }
      setThumbnails(newThumbs);
    };

    fetchThumbs();
    thumbTimerRef.current = setInterval(fetchThumbs, 3000);
    return () => clearInterval(thumbTimerRef.current);
  }, [connected, sources.length]);

  const handleToggle = async (sceneItemId: number, currentEnabled: boolean) => {
    try {
      const obs = getOBS();
      await toggleSource(obs, sceneItemId, !currentEnabled);
      const items = await listSources(obs);
      setSources(items);
    } catch {}
  };

  const handleReorder = async (sceneItemId: number, direction: 'up' | 'down') => {
    const sorted = [...sources].sort((a, b) => b.sceneItemIndex - a.sceneItemIndex);
    const idx = sorted.findIndex((s) => s.sceneItemId === sceneItemId);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;

    try {
      const obs = getOBS();
      await reorderSource(obs, sceneItemId, sorted[targetIdx].sceneItemIndex);
      const items = await listSources(obs);
      setSources(items);
    } catch {}
  };

  const sorted = [...sources].sort((a, b) => b.sceneItemIndex - a.sceneItemIndex);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-studio-muted text-sm">No sources yet</p>
        <p className="text-studio-muted/50 text-xs mt-1">Add a screen, webcam, or text overlay above</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {sorted.map((src, i) => {
        const isSelected = selectedSource === src.sourceName;
        const thumb = thumbnails[src.sourceName];

        return (
          <div
            key={src.sceneItemId}
            onClick={() => onSourceSelect?.(src.sourceName, src.sceneItemId)}
            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
              isSelected
                ? 'bg-studio-accent/10 border border-studio-accent/30'
                : 'bg-studio-card border border-studio-border hover:border-studio-accent/30'
            }`}
          >
            {/* Thumbnail */}
            <div className="w-12 h-7 rounded overflow-hidden bg-black shrink-0 border border-studio-border/50">
              {thumb ? (
                <img src={thumb} alt="" className="w-full h-full object-cover" draggable={false} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs">
                  {kindEmoji(src.inputKind)}
                </div>
              )}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium truncate ${src.sceneItemEnabled ? 'text-studio-text' : 'text-studio-muted line-through'}`}>
                {src.sourceName}
              </p>
              <p className="text-[10px] text-studio-muted">{friendlyName(src.inputKind)}</p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              {/* Visibility toggle */}
              <button
                onClick={() => handleToggle(src.sceneItemId, src.sceneItemEnabled)}
                className={`w-6 h-6 flex items-center justify-center rounded text-xs transition-colors ${
                  src.sceneItemEnabled
                    ? 'text-studio-text hover:text-studio-accent'
                    : 'text-studio-muted/40 hover:text-studio-muted'
                }`}
                title={src.sceneItemEnabled ? 'Hide' : 'Show'}
              >
                {src.sceneItemEnabled ? '\u{1F441}' : '\u{2014}'}
              </button>

              {/* Reorder */}
              <button
                onClick={() => handleReorder(src.sceneItemId, 'up')}
                disabled={i === 0}
                className="w-5 h-5 flex items-center justify-center rounded text-[10px] text-studio-muted hover:text-studio-text disabled:opacity-20"
                title="Move forward"
              >
                {'\u25B2'}
              </button>
              <button
                onClick={() => handleReorder(src.sceneItemId, 'down')}
                disabled={i === sorted.length - 1}
                className="w-5 h-5 flex items-center justify-center rounded text-[10px] text-studio-muted hover:text-studio-text disabled:opacity-20"
                title="Move back"
              >
                {'\u25BC'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
