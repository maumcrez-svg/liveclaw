import React, { useState } from 'react';
import { VOICE_OPTIONS } from '../../lib/wizard-types';
import type { WizardState } from '../../lib/wizard-types';
import { BUILT_IN_AVATARS } from '../AvatarPicker';

interface Template {
  id: string;
  img: string;
  name: string;
}

interface StepReviewProps {
  state: WizardState;
  templates: Template[];
  slug: string;
  onInstructionsChange: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}

export function StepReview({ state, templates, slug, onInstructionsChange, onBack, onSubmit }: StepReviewProps) {
  const [showConfig, setShowConfig] = useState(false);
  const template = templates.find((t) => t.id === state.templateId);
  const voiceInfo = VOICE_OPTIONS.find((v) => v.id === state.voice.ttsVoice);

  const configPreview = {
    personality: state.personality,
    voice: state.voice,
    llm: { model: state.llm.model, temperature: state.llm.temperature, maxTokens: state.llm.maxTokens, responseStyle: state.llm.responseStyle },
    avatar: state.avatar,
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h2 className="text-lg font-semibold text-studio-text text-center mb-1">Review your agent</h2>

      {/* Personality card */}
      <div className="p-4 rounded-xl border border-studio-border bg-studio-card shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <img
            src={(() => {
              if (state.avatar.type === 'upload' && state.avatar.uploadUrl) return state.avatar.uploadUrl;
              if (state.avatar.type === 'builtin') {
                const found = BUILT_IN_AVATARS.find(a => a.id === state.avatar.seed);
                if (found) return found.src;
              }
              return `https://api.dicebear.com/7.x/bottts/svg?seed=${slug}`;
            })()}
            alt=""
            className="w-12 h-12 rounded-xl border border-studio-border object-cover"
            draggable={false}
          />
          <div>
            <p className="text-sm font-semibold text-studio-text">{state.name || 'Unnamed'}</p>
            <p className="text-[11px] text-studio-muted">liveclaw.tv/{slug}</p>
          </div>
        </div>

        {/* Traits */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-studio-accent/10 text-studio-accent">{state.personality.tone}</span>
          {state.personality.humor !== 'playful' && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-studio-border text-studio-muted">{state.personality.humor} humor</span>
          )}
          {voiceInfo && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-studio-border text-studio-muted">{voiceInfo.emoji} {voiceInfo.label}</span>
          )}
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-studio-border text-studio-muted">{state.llm.model || 'No model'}</span>
        </div>

        {/* Values & flaws */}
        {(state.personality.values.length > 0 || state.personality.flaws.length > 0) && (
          <div className="text-[10px] text-studio-muted space-y-0.5">
            {state.personality.values.length > 0 && (
              <p>Values: {state.personality.values.join(', ')}</p>
            )}
            {state.personality.flaws.length > 0 && (
              <p>Flaws: {state.personality.flaws.join(', ')}</p>
            )}
          </div>
        )}

        {/* Emotional */}
        <div className="flex gap-3 mt-3">
          {Object.entries(state.personality.emotional).map(([key, val]) => (
            <div key={key} className="flex-1 text-center">
              <div className="text-[10px] text-studio-muted capitalize">{key}</div>
              <div className="flex gap-0.5 justify-center mt-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className={`w-1.5 h-1.5 rounded-full ${n <= val ? 'bg-studio-accent' : 'bg-studio-border'}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div>
        <label className="text-xs font-medium text-studio-muted block mb-1">
          Instructions <span className="text-studio-muted/50">(auto-generated, feel free to edit)</span>
        </label>
        <textarea
          value={state.generatedInstructions}
          onChange={(e) => onInstructionsChange(e.target.value)}
          rows={6}
          className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2 text-xs text-studio-text font-mono leading-relaxed focus:outline-none focus:border-studio-accent resize-none"
        />
      </div>

      {/* Config preview toggle */}
      <button
        type="button"
        onClick={() => setShowConfig(!showConfig)}
        className="text-[10px] text-studio-muted hover:text-studio-accent transition-colors"
      >
        {showConfig ? 'Hide config' : 'Show config JSON'}
      </button>
      {showConfig && (
        <pre className="text-[10px] font-mono text-studio-muted bg-studio-bg border border-studio-border rounded-lg p-3 overflow-x-auto max-h-40 overflow-y-auto">
          {JSON.stringify(configPreview, null, 2)}
        </pre>
      )}

      {/* Error */}
      {state.error && (
        <div className="p-3 rounded-lg bg-studio-live/10 border border-studio-live/20">
          <p className="text-sm text-studio-live">{state.error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="flex-1 py-2.5 border border-studio-border rounded-lg text-sm text-studio-muted hover:text-studio-text transition-colors">Back</button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={state.creating}
          className="flex-1 py-3 bg-studio-accent hover:bg-studio-accent-hover text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-studio-accent/25 disabled:opacity-50"
        >
          {state.creating ? 'Creating...' : 'Create & start streaming'}
        </button>
      </div>
    </div>
  );
}
