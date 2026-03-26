import React, { useState } from 'react';
import { PERSONALITY_TONES } from '../../lib/generate-instructions';
import { HUMOR_STYLES, EMOTIONAL_SLIDERS, VALUES_OPTIONS, FLAWS_OPTIONS } from '../../lib/wizard-types';
import type { PersonalityConfig } from '../../lib/wizard-types';
import { CardSelector } from './CardSelector';
import { WizardSlider } from './WizardSlider';
import { TagPicker } from './TagPicker';

interface StepPersonalityProps {
  personality: PersonalityConfig;
  onChange: (p: PersonalityConfig) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepPersonality({ personality, onChange, onNext, onBack }: StepPersonalityProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = (partial: Partial<PersonalityConfig>) => {
    onChange({ ...personality, ...partial });
  };

  const updateEmotional = (key: string, value: number) => {
    onChange({ ...personality, emotional: { ...personality.emotional, [key]: value } });
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h2 className="text-lg font-semibold text-studio-text text-center mb-1">How should it talk?</h2>
      <p className="text-sm text-studio-muted text-center mb-2">Pick a vibe. Customize deeper below.</p>

      {/* Tone cards */}
      <CardSelector
        options={PERSONALITY_TONES.map((t) => ({ id: t.id, label: t.label, desc: t.desc, emoji: t.emoji }))}
        selected={personality.tone}
        onChange={(tone) => update({ tone })}
        columns={3}
      />

      {/* Advanced toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full text-xs text-studio-accent hover:text-studio-accent-hover flex items-center justify-center gap-1 py-2 transition-colors"
      >
        <span className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>&#9656;</span>
        {showAdvanced ? 'Hide' : 'Customize personality'}
      </button>

      {/* Advanced section */}
      {showAdvanced && (
        <div className="space-y-4 pt-2 border-t border-studio-border animate-slide-down">
          {/* Humor */}
          <div>
            <label className="text-xs font-medium text-studio-muted block mb-2">Humor style</label>
            <CardSelector
              options={HUMOR_STYLES.map((h) => ({ id: h.id, label: h.label, desc: h.desc, emoji: h.emoji }))}
              selected={personality.humor}
              onChange={(humor) => update({ humor })}
              columns={3}
            />
          </div>

          {/* Emotional sliders */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-studio-muted block">Emotional baseline</label>
            {EMOTIONAL_SLIDERS.map((s) => (
              <WizardSlider
                key={s.id}
                value={personality.emotional[s.id as keyof typeof personality.emotional]}
                min={1}
                max={5}
                step={1}
                label={s.label}
                lowLabel={s.low}
                highLabel={s.high}
                formatValue={(v) => `${v}/5`}
                onChange={(v) => updateEmotional(s.id, v)}
              />
            ))}
          </div>

          {/* Values */}
          <TagPicker
            options={VALUES_OPTIONS}
            selected={personality.values}
            onChange={(values) => update({ values })}
            max={5}
            label="Core values"
            hint="pick up to 5"
          />

          {/* Flaws */}
          <TagPicker
            options={FLAWS_OPTIONS}
            selected={personality.flaws}
            onChange={(flaws) => update({ flaws })}
            max={3}
            label="Character flaws"
            hint="makes it feel real"
          />

          {/* Character notes */}
          <div>
            <label className="text-xs font-medium text-studio-muted block mb-1">Character notes</label>
            <textarea
              value={personality.characterNotes}
              onChange={(e) => update({ characterNotes: e.target.value })}
              rows={2}
              placeholder="Anything else about this character..."
              className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2 text-sm text-studio-text placeholder:text-studio-muted/50 focus:outline-none focus:border-studio-accent resize-none"
            />
          </div>
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
