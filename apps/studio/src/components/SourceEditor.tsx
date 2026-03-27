// ── Source editor panel ──────────────────────────────────────────────
//
// Slide-in panel for editing a selected source's transform (position,
// scale, rotation) and managing OBS filters. For text sources, also
// includes inline text editing controls (content, font, size, color,
// bold/italic, outline, shadow) — no separate TextEditor needed.

import React, { useState, useEffect, useRef } from 'react';
import { getOBS } from '../obs/connection';
import { getSourceTransform, setSourceTransform, removeSource, listSources, updateSourceSettings } from '../obs/scene';
import { listFilters, addFilter, removeFilter, FILTER_PRESETS } from '../obs/filters';
import { useOBSStore } from '../store/obs-store';
import type { FilterInfo } from '../obs/filters';

interface SourceEditorProps {
  sourceName: string;
  sceneItemId: number;
  inputKind: string;
  onClose: () => void;
}

const FONT_FACES = [
  'Sans Serif', 'Serif', 'Monospace', 'Arial', 'Helvetica',
  'Georgia', 'Courier New', 'Impact', 'Comic Sans MS',
];

function hexToABGR(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (255 << 24) | (b << 16) | (g << 8) | r;
}

function abgrToHex(abgr: number): string {
  const r = abgr & 0xFF;
  const g = (abgr >> 8) & 0xFF;
  const b = (abgr >> 16) & 0xFF;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function SourceEditor({ sourceName, sceneItemId, inputKind, onClose }: SourceEditorProps) {
  const setSources = useOBSStore((s) => s.setSources);
  const [loading, setLoading] = useState(true);

  // Transform state
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [lockAspect, setLockAspect] = useState(true);
  const [filters, setFilters] = useState<FilterInfo[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Text source state
  const isTextSource = inputKind.includes('text') || inputKind.includes('ft2');
  const [textContent, setTextContent] = useState('Hello World');
  const [fontFace, setFontFace] = useState('Sans Serif');
  const [fontSize, setFontSize] = useState(64);
  const [colorHex, setColorHex] = useState('#ffffff');
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [outline, setOutline] = useState(false);
  const [dropShadow, setDropShadow] = useState(false);
  const textDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Load current transform + filters (and text settings if applicable) on mount
  useEffect(() => {
    (async () => {
      try {
        const obs = getOBS();
        const t = await getSourceTransform(obs, sceneItemId);
        setPosX(Number(t.positionX) || 0);
        setPosY(Number(t.positionY) || 0);
        setScaleX(Number(t.scaleX) || 1);
        setScaleY(Number(t.scaleY) || 1);
        setRotation(Number(t.rotation) || 0);

        try {
          const f = await listFilters(obs, sourceName);
          setFilters(f);
        } catch {
          setFilters([]); // Filters not available for this source
        }

        // Load text-specific settings
        if (isTextSource) {
          try {
            const res = await obs.call<{ inputSettings: Record<string, any> }>(
              'GetInputSettings',
              { inputName: sourceName },
            );
            const s = res.inputSettings;
            if (s.text) setTextContent(s.text);
            if (s.font?.face) setFontFace(s.font.face);
            if (s.font?.size) setFontSize(s.font.size);
            if (s.color1 !== undefined) setColorHex(abgrToHex(s.color1));
            if (s.font?.flags) {
              setBold(!!(s.font.flags & 1));
              setItalic(!!(s.font.flags & 2));
            }
            if (s.outline !== undefined) setOutline(s.outline);
            if (s.drop_shadow !== undefined) setDropShadow(s.drop_shadow);
          } catch {
            // Use text defaults
          }
        }
      } catch {
        // Use defaults
      }
      setLoading(false);
    })();
  }, [sourceName, sceneItemId, isTextSource]);

  // Debounced apply transform -- skip while still loading
  const applyTransform = () => {
    if (loading) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const obs = getOBS();
        await setSourceTransform(obs, sceneItemId, {
          positionX: posX,
          positionY: posY,
          scaleX,
          scaleY,
          rotation,
        });
      } catch {
        // Transform update failed
      }
    }, 200);
  };

  useEffect(() => {
    applyTransform();
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posX, posY, scaleX, scaleY, rotation]);

  // Debounced apply text settings -- skip while still loading
  const applyTextSettings = () => {
    if (loading || !isTextSource) return;
    if (textDebounceRef.current) clearTimeout(textDebounceRef.current);
    textDebounceRef.current = setTimeout(async () => {
      try {
        const obs = getOBS();
        const flags = (bold ? 1 : 0) | (italic ? 2 : 0);
        await updateSourceSettings(obs, sourceName, {
          text: textContent,
          font: { face: fontFace, size: fontSize, style: '', flags },
          color1: hexToABGR(colorHex),
          color2: hexToABGR(colorHex),
          outline,
          drop_shadow: dropShadow,
        });
      } catch {
        // Text update failed
      }
    }, 300);
  };

  useEffect(() => {
    if (!isTextSource || loading) return;
    applyTextSettings();
    return () => { if (textDebounceRef.current) clearTimeout(textDebounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textContent, fontFace, fontSize, colorHex, bold, italic, outline, dropShadow]);

  const handleScaleX = (val: number) => {
    setScaleX(val);
    if (lockAspect) setScaleY(val);
  };

  const handleScaleY = (val: number) => {
    setScaleY(val);
    if (lockAspect) setScaleX(val);
  };

  const handleAddFilter = async (preset: typeof FILTER_PRESETS[number]) => {
    try {
      const obs = getOBS();
      const name = `${preset.label} ${Date.now().toString(36).slice(-3)}`;
      await addFilter(obs, sourceName, name, preset.filterKind, { ...preset.defaultSettings });
      const f = await listFilters(obs, sourceName);
      setFilters(f);
    } catch {
      // Filter add failed
    }
  };

  const handleRemoveFilter = async (filterName: string) => {
    try {
      const obs = getOBS();
      await removeFilter(obs, sourceName, filterName);
      const f = await listFilters(obs, sourceName);
      setFilters(f);
    } catch {
      // Filter remove failed
    }
  };

  const handleDelete = async () => {
    try {
      const obs = getOBS();
      await removeSource(obs, sceneItemId);
      const items = await listSources(obs);
      setSources(items);
      onClose();
    } catch {
      // Delete failed
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-studio-card border-l border-studio-border z-30 flex flex-col shadow-2xl animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-studio-border">
        <div className="flex items-center gap-2 min-w-0">
          {isTextSource && <span className="text-xs text-studio-accent shrink-0">Aa</span>}
          <h3 className="text-sm font-semibold text-studio-text truncate">{sourceName}</h3>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-studio-border/50 text-studio-muted hover:text-studio-text transition-colors shrink-0"
        >
          &times;
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-studio-border border-t-studio-accent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Text source settings */}
          {isTextSource && (
            <div className="space-y-3 pb-4 border-b border-studio-border">
              <label className="text-xs font-medium text-studio-muted block">Text content</label>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={2}
                className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2 text-sm text-studio-text focus:outline-none focus:border-studio-accent resize-none"
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-studio-muted block mb-1">Font</label>
                  <select
                    value={fontFace}
                    onChange={(e) => setFontFace(e.target.value)}
                    className="w-full bg-studio-bg border border-studio-border rounded px-2 py-1.5 text-xs text-studio-text focus:outline-none focus:border-studio-accent"
                  >
                    {FONT_FACES.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-studio-muted block mb-1">Size: {fontSize}px</label>
                  <input
                    type="range"
                    min={12}
                    max={200}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full accent-studio-accent"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  className="w-8 h-8 rounded border border-studio-border cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={colorHex}
                  onChange={(e) => {
                    if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setColorHex(e.target.value);
                  }}
                  className="flex-1 bg-studio-bg border border-studio-border rounded px-2 py-1.5 text-xs text-studio-text font-mono focus:outline-none focus:border-studio-accent"
                />
                <button
                  type="button"
                  onClick={() => setBold(!bold)}
                  className={`px-2 py-1.5 rounded border text-xs font-bold transition-colors ${
                    bold
                      ? 'border-studio-accent bg-studio-accent/10 text-studio-accent'
                      : 'border-studio-border text-studio-muted hover:text-studio-text'
                  }`}
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => setItalic(!italic)}
                  className={`px-2 py-1.5 rounded border text-xs italic transition-colors ${
                    italic
                      ? 'border-studio-accent bg-studio-accent/10 text-studio-accent'
                      : 'border-studio-border text-studio-muted hover:text-studio-text'
                  }`}
                >
                  I
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOutline(!outline)}
                  className={`flex-1 px-2 py-1.5 rounded border text-[10px] transition-colors ${
                    outline
                      ? 'border-studio-accent bg-studio-accent/10 text-studio-accent'
                      : 'border-studio-border text-studio-muted hover:text-studio-text'
                  }`}
                >
                  Outline
                </button>
                <button
                  type="button"
                  onClick={() => setDropShadow(!dropShadow)}
                  className={`flex-1 px-2 py-1.5 rounded border text-[10px] transition-colors ${
                    dropShadow
                      ? 'border-studio-accent bg-studio-accent/10 text-studio-accent'
                      : 'border-studio-border text-studio-muted hover:text-studio-text'
                  }`}
                >
                  Shadow
                </button>
              </div>
            </div>
          )}

          {/* Position */}
          <div>
            <label className="text-xs font-medium text-studio-muted block mb-2">Position</label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-studio-muted w-3">X</span>
                <input
                  type="range"
                  min={0}
                  max={1920}
                  value={posX}
                  onChange={(e) => setPosX(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-studio-accent"
                />
                <span className="text-[10px] text-studio-accent font-mono w-10 text-right">{Math.round(posX)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-studio-muted w-3">Y</span>
                <input
                  type="range"
                  min={0}
                  max={1080}
                  value={posY}
                  onChange={(e) => setPosY(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-studio-accent"
                />
                <span className="text-[10px] text-studio-accent font-mono w-10 text-right">{Math.round(posY)}</span>
              </div>
            </div>
          </div>

          {/* Scale */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-studio-muted">Size</label>
              <button
                onClick={() => setLockAspect(!lockAspect)}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  lockAspect ? 'text-studio-accent bg-studio-accent/10' : 'text-studio-muted'
                }`}
              >
                {lockAspect ? 'Locked' : 'Free'}
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-studio-muted w-3">W</span>
                <input
                  type="range"
                  min={0.1}
                  max={3}
                  step={0.05}
                  value={scaleX}
                  onChange={(e) => handleScaleX(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-studio-accent"
                />
                <span className="text-[10px] text-studio-accent font-mono w-10 text-right">{Math.round(scaleX * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-studio-muted w-3">H</span>
                <input
                  type="range"
                  min={0.1}
                  max={3}
                  step={0.05}
                  value={scaleY}
                  onChange={(e) => handleScaleY(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-studio-accent"
                />
                <span className="text-[10px] text-studio-accent font-mono w-10 text-right">{Math.round(scaleY * 100)}%</span>
              </div>
            </div>
          </div>

          {/* Rotation */}
          <div>
            <label className="text-xs font-medium text-studio-muted block mb-2">Rotation</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={360}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-studio-accent"
              />
              <span className="text-[10px] text-studio-accent font-mono w-10 text-right">{Math.round(rotation)}&deg;</span>
            </div>
          </div>

          {/* Filters */}
          <div>
            <label className="text-xs font-medium text-studio-muted block mb-2">Filters</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {FILTER_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleAddFilter(p)}
                  className="text-[10px] px-2 py-1 rounded-full border border-studio-border text-studio-muted hover:border-studio-accent hover:text-studio-accent transition-colors"
                >
                  {p.emoji} {p.label}
                </button>
              ))}
            </div>
            {filters.length > 0 && (
              <div className="space-y-1">
                {filters.map((f) => (
                  <div key={f.filterName} className="flex items-center justify-between py-1 px-2 rounded bg-studio-bg border border-studio-border">
                    <span className="text-[10px] text-studio-text truncate">{f.filterName}</span>
                    <button
                      onClick={() => handleRemoveFilter(f.filterName)}
                      className="text-[10px] text-studio-muted hover:text-studio-live ml-2"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delete */}
          <div className="pt-2 border-t border-studio-border">
            <button
              onClick={handleDelete}
              className="w-full py-2 rounded-lg border border-studio-live/30 text-studio-live text-xs hover:bg-studio-live/10 transition-colors"
            >
              Delete source
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-studio-border">
        <p className="text-[10px] text-studio-muted text-center">
          Changes apply in real-time
        </p>
      </div>
    </div>
  );
}
