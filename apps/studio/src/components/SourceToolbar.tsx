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
import { resolveInputKind } from '../obs/sources';

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
  const supportedKinds = useOBSStore((s) => s.supportedInputKinds);
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
          const kind = resolveInputKind('display', supportedKinds);
          if (!kind) break;
          await addSource(obs, { inputName: 'Display Capture', inputKind: kind, inputSettings: {} });
          break;
        }
        case 'webcam': {
          const kind = resolveInputKind('webcam', supportedKinds);
          if (!kind) break;
          await addSource(obs, { inputName: 'Webcam', inputKind: kind, inputSettings: {} });
          break;
        }
        case 'text': {
          const kind = resolveInputKind('text', supportedKinds);
          if (!kind) break;
          const name = `Text ${Date.now().toString(36).slice(-4)}`;
          await addSource(obs, {
            inputName: name,
            inputKind: kind,
            inputSettings: {
              text: 'Hello World',
              font: { face: 'Sans Serif', size: 64, style: '', flags: 0 },
              color1: 4294967295,
              color2: 4294967295,
            },
          });
          // Refresh first so the callback can find the new item
          const items = await listSources(obs);
          setSources(items);
          flashSuccess(buttonId);
          setAdding(null);
          onTextAdded?.(name);
          return;
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

  // Hide buttons for source categories that OBS doesn't support
  const availableButtons = supportedKinds.length > 0
    ? QUICK_BUTTONS.filter((btn) => {
        // image/browser are always available (standard OBS kinds)
        if (btn.id === 'image' || btn.id === 'browser') return true;
        return resolveInputKind(btn.id as any, supportedKinds) !== null;
      })
    : QUICK_BUTTONS; // show all until detection finishes

  return (
    <div className="flex gap-1.5 py-2">
      {availableButtons.map((btn) => (
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
