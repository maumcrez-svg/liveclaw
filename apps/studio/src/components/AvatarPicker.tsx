import React, { useState, useRef } from 'react';

// Import all built-in avatars
import robotRed from '../assets/avatars/robot-red.png';
import robotBlue from '../assets/avatars/robot-blue.png';
import catCyber from '../assets/avatars/cat-cyber.png';
import foxSmart from '../assets/avatars/fox-smart.png';
import owlWise from '../assets/avatars/owl-wise.png';
import pandaChill from '../assets/avatars/panda-chill.png';
import skullCool from '../assets/avatars/skull-cool.png';
import alienGreen from '../assets/avatars/alien-green.png';
import bearGamer from '../assets/avatars/bear-gamer.png';
import penguinTux from '../assets/avatars/penguin-tux.png';
import ghostGlow from '../assets/avatars/ghost-glow.png';
import dragonMini from '../assets/avatars/dragon-mini.png';

const BUILT_IN_AVATARS = [
  { id: 'robot-red', src: robotRed, label: 'Red Robot' },
  { id: 'robot-blue', src: robotBlue, label: 'Blue Robot' },
  { id: 'cat-cyber', src: catCyber, label: 'Cyber Cat' },
  { id: 'fox-smart', src: foxSmart, label: 'Smart Fox' },
  { id: 'owl-wise', src: owlWise, label: 'Wise Owl' },
  { id: 'panda-chill', src: pandaChill, label: 'Chill Panda' },
  { id: 'skull-cool', src: skullCool, label: 'Cool Skull' },
  { id: 'alien-green', src: alienGreen, label: 'Green Alien' },
  { id: 'bear-gamer', src: bearGamer, label: 'Gamer Bear' },
  { id: 'penguin-tux', src: penguinTux, label: 'Tux Penguin' },
  { id: 'ghost-glow', src: ghostGlow, label: 'Glowing Ghost' },
  { id: 'dragon-mini', src: dragonMini, label: 'Mini Dragon' },
];

const EXTERNAL_SOURCES = [
  {
    name: 'VRoid Studio',
    desc: 'Free 3D anime-style avatars. Create your own or download from the hub.',
    url: 'https://vroid.com/en/studio',
    tag: 'Free',
  },
  {
    name: 'Ready Player Me',
    desc: 'Free realistic 3D avatars from a selfie or custom builder.',
    url: 'https://readyplayer.me',
    tag: 'Free',
  },
  {
    name: 'Booth.pm',
    desc: 'Marketplace for Live2D models. Many affordable options ($5-20).',
    url: 'https://booth.pm/en/browse/3D%20Models',
    tag: '$5-20',
  },
  {
    name: 'Mixamo',
    desc: 'Free 3D character animations by Adobe. Pair with any 3D model.',
    url: 'https://www.mixamo.com',
    tag: 'Free',
  },
];

interface AvatarPickerProps {
  selected: { type: string; seed: string; uploadUrl?: string };
  onChange: (avatar: { type: 'dicebear' | 'upload' | 'builtin'; seed: string; uploadUrl?: string }) => void;
  slug: string;
}

export function AvatarPicker({ selected, onChange, slug }: AvatarPickerProps) {
  const [tab, setTab] = useState<'builtin' | 'upload' | 'help'>('builtin');
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(selected.type === 'upload' ? selected.uploadUrl || null : null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setUploadPreview(dataUrl);
      onChange({ type: 'upload', seed: slug, uploadUrl: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="rounded-xl border border-studio-border overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-studio-border">
        {(['builtin', 'upload', 'help'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              tab === t
                ? 'bg-studio-card text-studio-text border-b-2 border-studio-accent'
                : 'text-studio-muted hover:text-studio-text'
            }`}
          >
            {t === 'builtin' ? 'Built-in' : t === 'upload' ? 'Upload' : 'Find more'}
          </button>
        ))}
      </div>

      <div className="p-3">
        {/* Built-in avatars */}
        {tab === 'builtin' && (
          <div className="grid grid-cols-4 gap-2">
            {/* Dicebear (auto-generated) */}
            <button
              type="button"
              onClick={() => onChange({ type: 'dicebear', seed: slug })}
              className={`p-1.5 rounded-lg border transition-all ${
                selected.type === 'dicebear'
                  ? 'border-studio-accent bg-studio-accent/10'
                  : 'border-studio-border hover:border-studio-accent/50'
              }`}
            >
              <img
                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${slug || 'agent'}`}
                alt="Auto"
                className="w-full aspect-square rounded object-cover"
                draggable={false}
              />
              <p className="text-[9px] text-studio-muted text-center mt-1">Auto</p>
            </button>

            {/* Built-in collection */}
            {BUILT_IN_AVATARS.map((av) => (
              <button
                key={av.id}
                type="button"
                onClick={() => onChange({ type: 'builtin', seed: av.id })}
                className={`p-1.5 rounded-lg border transition-all ${
                  selected.type === 'builtin' && selected.seed === av.id
                    ? 'border-studio-accent bg-studio-accent/10'
                    : 'border-studio-border hover:border-studio-accent/50'
                }`}
              >
                <img
                  src={av.src}
                  alt={av.label}
                  className="w-full aspect-square rounded object-contain"
                  draggable={false}
                />
                <p className="text-[9px] text-studio-muted text-center mt-1 truncate">{av.label}</p>
              </button>
            ))}
          </div>
        )}

        {/* Upload */}
        {tab === 'upload' && (
          <div className="text-center py-4">
            {uploadPreview ? (
              <div className="flex flex-col items-center gap-3">
                <img
                  src={uploadPreview}
                  alt="Custom avatar"
                  className="w-24 h-24 rounded-xl border border-studio-border object-cover"
                  draggable={false}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-xs text-studio-accent hover:text-studio-accent-hover"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadPreview(null);
                      onChange({ type: 'dicebear', seed: slug });
                    }}
                    className="text-xs text-studio-muted hover:text-studio-live"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
                role="button"
                tabIndex={0}
                className="border-2 border-dashed border-studio-border rounded-xl p-6 cursor-pointer hover:border-studio-accent/50 transition-colors"
              >
                <p className="text-2xl mb-2">{'\u{1F5BC}\u{FE0F}'}</p>
                <p className="text-xs text-studio-text font-medium">Drop an image or click to browse</p>
                <p className="text-[10px] text-studio-muted mt-1">PNG, JPG, GIF, WebP -- any size</p>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        )}

        {/* External sources */}
        {tab === 'help' && (
          <div className="space-y-2">
            <p className="text-xs text-studio-muted mb-2">Find avatars and 2D/3D models from these sources:</p>
            {EXTERNAL_SOURCES.map((src) => (
              <a
                key={src.name}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-2.5 rounded-lg border border-studio-border hover:border-studio-accent/50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-studio-text font-medium group-hover:text-studio-accent transition-colors">{src.name}</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-studio-accent/10 text-studio-accent">{src.tag}</span>
                  </div>
                  <p className="text-[10px] text-studio-muted mt-0.5">{src.desc}</p>
                </div>
                <span className="text-studio-muted text-xs shrink-0">{'\u{2192}'}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Export for use in other components
export { BUILT_IN_AVATARS };
