import React, { useState, useRef } from 'react';
import { VOICE_OPTIONS, SPEED_OPTIONS, TTS_MODELS } from '../../lib/wizard-types';
import type { VoiceConfig } from '../../lib/wizard-types';
import { CardSelector } from './CardSelector';
import { WizardSlider } from './WizardSlider';

// Voice sample audio files
import sampleAlloy from '../../assets/voice-samples/alloy.mp3';
import sampleEcho from '../../assets/voice-samples/echo.mp3';
import sampleFable from '../../assets/voice-samples/fable.mp3';
import sampleOnyx from '../../assets/voice-samples/onyx.mp3';
import sampleNova from '../../assets/voice-samples/nova.mp3';
import sampleShimmer from '../../assets/voice-samples/shimmer.mp3';

const VOICE_SAMPLES: Record<string, string> = {
  alloy: sampleAlloy,
  echo: sampleEcho,
  fable: sampleFable,
  onyx: sampleOnyx,
  nova: sampleNova,
  shimmer: sampleShimmer,
};

interface StepVoiceProps {
  voice: VoiceConfig;
  onChange: (v: VoiceConfig) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepVoice({ voice, onChange, onNext, onBack }: StepVoiceProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const update = (partial: Partial<VoiceConfig>) => onChange({ ...voice, ...partial });

  const playVoiceSample = (voiceId: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    if (playing === voiceId) {
      setPlaying(null);
      return;
    }

    const src = VOICE_SAMPLES[voiceId];
    if (!src) return;

    // Use existing audio element or create one (avoids CSP issues in Tauri)
    if (!audioRef.current) {
      audioRef.current = document.createElement('audio');
      document.body.appendChild(audioRef.current);
      audioRef.current.style.display = 'none';
    }

    audioRef.current.src = src;
    audioRef.current.onended = () => setPlaying(null);
    audioRef.current.onerror = () => {
      console.error('[Voice] Failed to play sample:', voiceId);
      setPlaying(null);
    };

    setPlaying(voiceId);
    audioRef.current.play().catch((err) => {
      console.error('[Voice] Play error:', err);
      setPlaying(null);
    });
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h2 className="text-lg font-semibold text-studio-text text-center mb-1">Pick a voice</h2>
      <p className="text-sm text-studio-muted text-center mb-2">How your agent sounds on stream. Click to preview.</p>

      {/* Voice cards with play button */}
      <div className="grid grid-cols-3 gap-2">
        {VOICE_OPTIONS.map((v) => (
          <div
            key={v.id}
            className={`rounded-lg border text-center transition-all ${
              voice.ttsVoice === v.id
                ? 'border-studio-accent bg-studio-accent/10'
                : 'border-studio-border hover:border-studio-accent/50 hover:bg-studio-card'
            }`}
          >
            <button
              type="button"
              onClick={() => update({ ttsVoice: v.id })}
              className="w-full p-3 pb-1"
            >
              <span className="text-lg block">{v.emoji}</span>
              <span className="text-xs text-studio-text font-medium block mt-1">{v.label}</span>
              <span className="text-[10px] text-studio-muted block mt-0.5">{v.desc}</span>
            </button>
            <button
              type="button"
              onClick={() => playVoiceSample(v.id)}
              className={`w-full py-1.5 text-[10px] font-medium transition-colors rounded-b-lg ${
                playing === v.id
                  ? 'text-studio-accent bg-studio-accent/5'
                  : 'text-studio-muted hover:text-studio-accent'
              }`}
            >
              {playing === v.id ? '\u{23F9} Stop' : '\u{25B6} Preview'}
            </button>
          </div>
        ))}
      </div>

      {/* Speed toggle */}
      <div>
        <label className="text-xs font-medium text-studio-muted block mb-2">Speech speed</label>
        <div className="flex bg-studio-bg rounded-lg p-0.5 border border-studio-border">
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => update({ speechSpeed: s.id, charsPerSecond: s.cps })}
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
                voice.speechSpeed === s.id
                  ? 'bg-studio-accent text-white shadow-sm'
                  : 'text-studio-muted hover:text-studio-text'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full text-xs text-studio-accent hover:text-studio-accent-hover flex items-center justify-center gap-1 py-2 transition-colors"
      >
        <span className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>&#9656;</span>
        {showAdvanced ? 'Hide' : 'Fine-tune voice'}
      </button>

      {showAdvanced && (
        <div className="space-y-4 pt-2 border-t border-studio-border animate-slide-down">
          {/* Voice instructions */}
          <div>
            <label className="text-xs font-medium text-studio-muted block mb-1">Voice style guide</label>
            <textarea
              value={voice.voiceInstructions}
              onChange={(e) => update({ voiceInstructions: e.target.value })}
              rows={3}
              placeholder="e.g. Speak with a slight rasp, like a late-night radio host. Pause before punchlines."
              className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2 text-sm text-studio-text placeholder:text-studio-muted/50 focus:outline-none focus:border-studio-accent resize-none"
            />
          </div>

          {/* TTS model */}
          <div>
            <label className="text-xs font-medium text-studio-muted block mb-2">TTS model</label>
            <div className="flex gap-2">
              {TTS_MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => update({ ttsModel: m.id })}
                  className={`flex-1 py-2 px-2 rounded-lg border text-center transition-all ${
                    voice.ttsModel === m.id
                      ? 'border-studio-accent bg-studio-accent/10'
                      : 'border-studio-border hover:border-studio-accent/50'
                  }`}
                >
                  <span className="text-xs text-studio-text block">{m.label}</span>
                  <span className="text-[10px] text-studio-muted">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CPS slider */}
          <WizardSlider
            value={voice.charsPerSecond}
            min={8}
            max={25}
            step={1}
            label="Speech rate"
            lowLabel="Slow & deliberate"
            highLabel="Rapid fire"
            formatValue={(v) => `${v} chars/s`}
            onChange={(charsPerSecond) => update({ charsPerSecond })}
          />
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="flex-1 py-2.5 border border-studio-border rounded-lg text-sm text-studio-muted hover:text-studio-text transition-colors">Back</button>
        <button type="button" onClick={onNext} className="flex-1 py-2.5 bg-studio-accent hover:bg-studio-accent-hover text-white rounded-lg text-sm font-medium transition-colors">Next</button>
      </div>
    </div>
  );
}
