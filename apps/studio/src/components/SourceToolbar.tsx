// ── Source toolbar ──────────────────────────────────────────────────
//
// Normie-friendly horizontal bar of quick-add buttons for common sources.
// Sits below the scene preview. Screen/Webcam/Text add immediately;
// Image/Browser open the full AddSourceModal for config. Briefly flashes
// green on success for visual feedback.

import React, { useState } from 'react';
import { getOBS } from '../obs/connection';
import { addSource, listSources } from '../obs/scene';
import { useOBSStore } from '../store/obs-store';
import { getDefaultDisplaySource, getDisplayCaptureFallbacks, SOURCE_TYPES } from '../obs/sources';

import iconScreen from '../assets/icon-screen.png';
import iconWebcam from '../assets/icon-webcam.png';
import iconText from '../assets/icon-text.png';
import iconImage from '../assets/icon-image.png';
import iconBrowser from '../assets/icon-browser.png';

interface SourceToolbarProps {
  onTextAdded?: (inputName: string) => void;
  onNeedConfig?: (sourceId: string) => void;
}

const QUICK_BUTTONS = [
  { id: 'display', img: iconScreen, label: 'Screen' },
  { id: 'webcam', img: iconWebcam, label: 'Webcam' },
  { id: 'text', img: iconText, label: 'Text' },
  { id: 'image', img: iconImage, label: 'Image' },
  { id: 'browser', img: iconBrowser, label: 'Browser' },
];

export function SourceToolbar({ onTextAdded, onNeedConfig }: SourceToolbarProps) {
  const setSources = useOBSStore((s) => s.setSources);
  const [adding, setAdding] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const flashSuccess = (buttonId: string) => {
    setLastAdded(buttonId);
    setTimeout(() => setLastAdded(null), 1500);
  };

  const handleAdd = async (buttonId: string) => {
    setAdding(buttonId);
    const obs = getOBS();

    try {
      switch (buttonId) {
        case 'display': {
          const fallbacks = getDisplayCaptureFallbacks();
          for (const kind of fallbacks) {
            try {
              await addSource(obs, {
                inputName: 'Display Capture',
                inputKind: kind,
                inputSettings: {},
              });
              break;
            } catch {
              // This kind not supported, try next
            }
          }
          break;
        }
        case 'webcam': {
          const webcam = SOURCE_TYPES.find((s) => s.id === 'webcam');
          if (webcam) {
            await addSource(obs, {
              inputName: 'Webcam',
              inputKind: webcam.obsInputKind,
              inputSettings: webcam.defaultSettings || {},
            });
          }
          break;
        }
        case 'text': {
          const textSrc = SOURCE_TYPES.find((s) => s.id === 'text');
          if (textSrc) {
            const name = `Text ${Date.now().toString(36).slice(-4)}`;
            await addSource(obs, {
              inputName: name,
              inputKind: textSrc.obsInputKind,
              inputSettings: textSrc.defaultSettings || {},
            });
            // Refresh first so the callback can find the new item
            const items = await listSources(obs);
            setSources(items);
            flashSuccess(buttonId);
            setAdding(null);
            onTextAdded?.(name);
            return;
          }
          break;
        }
        case 'image':
        case 'browser':
          onNeedConfig?.(buttonId);
          setAdding(null);
          return;
      }

      // Refresh source list
      try {
        const items = await listSources(obs);
        setSources(items);
      } catch {
        // Refresh failed — UI may be stale
      }
      flashSuccess(buttonId);
    } catch (err: any) {
      console.error('Failed to add source:', err);
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="flex gap-1.5 py-2">
      {QUICK_BUTTONS.map((btn) => (
        <button
          key={btn.id}
          onClick={() => handleAdd(btn.id)}
          disabled={adding !== null}
          className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg border bg-studio-card transition-all disabled:opacity-50 group ${
            lastAdded === btn.id
              ? 'border-studio-success bg-studio-success/10'
              : adding === btn.id
              ? 'border-studio-accent'
              : 'border-studio-border hover:border-studio-accent hover:bg-studio-accent/5'
          }`}
          title={`Add ${btn.label}`}
        >
          <div className="w-10 h-10 flex items-center justify-center group-hover:scale-110 transition-transform">
            {adding === btn.id ? (
              <span className="inline-block w-5 h-5 border-2 border-studio-border border-t-studio-accent rounded-full animate-spin" />
            ) : lastAdded === btn.id ? (
              <span className="text-lg text-studio-success">{'\u2713'}</span>
            ) : (
              <img src={btn.img} alt={btn.label} className="w-10 h-10 object-contain" draggable={false} />
            )}
          </div>
          <span className={`text-[10px] transition-colors ${
            lastAdded === btn.id
              ? 'text-studio-success'
              : 'text-studio-muted group-hover:text-studio-text'
          }`}>
            {btn.label}
          </span>
        </button>
      ))}
    </div>
  );
}
