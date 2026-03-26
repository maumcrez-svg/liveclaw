import React, { useState } from 'react';
import { detectProvider, MODEL_OPTIONS, RESPONSE_STYLES } from '../../lib/wizard-types';
import type { LLMConfig } from '../../lib/wizard-types';
import { WizardSlider } from './WizardSlider';
import { CardSelector } from './CardSelector';

interface StepAIEngineProps {
  apiKey: string;
  showApiKey: boolean;
  llm: LLMConfig;
  onApiKeyChange: (key: string) => void;
  onToggleShowKey: () => void;
  onLLMChange: (l: LLMConfig) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepAIEngine({
  apiKey, showApiKey, llm, onApiKeyChange, onToggleShowKey, onLLMChange, onNext, onBack,
}: StepAIEngineProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const provider = detectProvider(apiKey);
  const models = provider ? MODEL_OPTIONS[provider.id] || [] : [];
  const update = (partial: Partial<LLMConfig>) => onLLMChange({ ...llm, ...partial });

  const handleKeyChange = (key: string) => {
    onApiKeyChange(key);
    const p = detectProvider(key);
    if (p && MODEL_OPTIONS[p.id]) {
      update({ provider: p.id, model: MODEL_OPTIONS[p.id][0].id });
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h2 className="text-lg font-semibold text-studio-text text-center mb-1">Connect your AI</h2>
      <p className="text-sm text-studio-muted text-center mb-2">Your agent needs a brain. Paste your API key.</p>

      {/* API Key */}
      <div>
        <label className="text-xs font-medium text-studio-muted block mb-1">API Key</label>
        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => handleKeyChange(e.target.value)}
            placeholder="sk-... or sk-ant-..."
            className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2.5 text-sm text-studio-text font-mono placeholder:text-studio-muted/50 focus:outline-none focus:border-studio-accent pr-14"
          />
          <button type="button" onClick={onToggleShowKey} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-studio-muted hover:text-studio-text px-1">
            {showApiKey ? 'Hide' : 'Show'}
          </button>
        </div>
        {apiKey && provider && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-studio-accent/10 text-studio-accent font-medium">{provider.name}</span>
            <span className="text-xs text-studio-muted">detected</span>
          </div>
        )}
        {apiKey && !provider && (
          <p className="text-xs text-studio-live mt-1">Unrecognized key format</p>
        )}
      </div>

      {/* Model */}
      {models.length > 0 && (
        <div>
          <label className="text-xs font-medium text-studio-muted block mb-2">Model</label>
          <div className="grid grid-cols-2 gap-2">
            {models.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => update({ model: m.id })}
                className={`p-3 rounded-lg border text-left transition-all ${
                  llm.model === m.id ? 'border-studio-accent bg-studio-accent/10' : 'border-studio-border hover:border-studio-accent/50'
                }`}
              >
                <span className="text-sm text-studio-text block">{m.name}</span>
                <span className="text-[10px] text-studio-muted">{m.id}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Advanced */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full text-xs text-studio-accent hover:text-studio-accent-hover flex items-center justify-center gap-1 py-2 transition-colors"
      >
        <span className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>&#9656;</span>
        {showAdvanced ? 'Hide' : 'Tune AI behavior'}
      </button>

      {showAdvanced && (
        <div className="space-y-4 pt-2 border-t border-studio-border animate-slide-down">
          <WizardSlider
            value={llm.temperature}
            min={0}
            max={2}
            step={0.1}
            label="Temperature"
            lowLabel="Focused"
            highLabel="Creative"
            formatValue={(v) => v.toFixed(1)}
            onChange={(temperature) => update({ temperature })}
          />

          <WizardSlider
            value={llm.maxTokens}
            min={100}
            max={2000}
            step={50}
            label="Max tokens"
            lowLabel="Brief"
            highLabel="Detailed"
            onChange={(maxTokens) => update({ maxTokens })}
          />

          <div>
            <label className="text-xs font-medium text-studio-muted block mb-2">Response style</label>
            <CardSelector
              options={RESPONSE_STYLES.map((r) => ({ id: r.id, label: r.label, desc: r.desc, emoji: '' }))}
              selected={llm.responseStyle}
              onChange={(responseStyle: string) => update({ responseStyle: responseStyle as LLMConfig['responseStyle'] })}
              columns={3}
            />
          </div>
        </div>
      )}

      <p className="text-[10px] text-studio-muted text-center">Your key is stored securely and only used by your agent.</p>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="flex-1 py-2.5 border border-studio-border rounded-lg text-sm text-studio-muted hover:text-studio-text transition-colors">Back</button>
        <button type="button" onClick={onNext} disabled={!apiKey || !provider || !llm.model} className="flex-1 py-2.5 bg-studio-accent hover:bg-studio-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">Next</button>
      </div>
    </div>
  );
}
