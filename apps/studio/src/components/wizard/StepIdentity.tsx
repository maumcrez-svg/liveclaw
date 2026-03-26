import React, { useRef } from 'react';
import { AvatarPicker } from '../AvatarPicker';
import type { AvatarConfig } from '../../lib/wizard-types';

interface ConfigField {
  key: string;
  label: string;
  placeholder: string;
}

interface StepIdentityProps {
  name: string;
  description: string;
  templateConfig: Record<string, unknown>;
  configFields: ConfigField[];
  uploadedPromptName: string | null;
  slug: string;
  avatar: AvatarConfig;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onConfigChange: (key: string, value: string) => void;
  onUploadPrompt: (content: string, filename: string) => void;
  onClearPrompt: () => void;
  onAvatarChange: (avatar: AvatarConfig) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepIdentity({
  name, description, templateConfig, configFields, uploadedPromptName, slug, avatar,
  onNameChange, onDescriptionChange, onConfigChange,
  onUploadPrompt, onClearPrompt, onAvatarChange, onNext, onBack,
}: StepIdentityProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onUploadPrompt(reader.result as string, file.name);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h2 className="text-lg font-semibold text-studio-text text-center mb-1">Give it an identity</h2>

      {/* Name */}
      <div>
        <label className="text-xs font-medium text-studio-muted block mb-1">Agent name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. DeFi Oracle, ChillBot, CodeMonkey"
          autoFocus
          className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2.5 text-sm text-studio-text placeholder:text-studio-muted/50 focus:outline-none focus:border-studio-accent"
        />
        {name && (
          <p className="text-[10px] text-studio-muted mt-1">liveclaw.tv/{slug}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-medium text-studio-muted block mb-1">What does it do?</label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={2}
          placeholder="Describe your agent in a sentence or two..."
          className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2 text-sm text-studio-text placeholder:text-studio-muted/50 focus:outline-none focus:border-studio-accent resize-none"
        />
      </div>

      {/* Template-specific fields */}
      {configFields.map((field) => (
        <div key={field.key}>
          <label className="text-xs font-medium text-studio-muted block mb-1">{field.label}</label>
          <input
            type="text"
            value={(templateConfig[field.key] as string) || ''}
            onChange={(e) => onConfigChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2.5 text-sm text-studio-text placeholder:text-studio-muted/50 focus:outline-none focus:border-studio-accent"
          />
        </div>
      ))}

      {/* Upload custom prompt */}
      <div className="p-3 rounded-lg border border-dashed border-studio-border">
        {uploadedPromptName ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-studio-success text-sm">&#10003;</span>
              <span className="text-xs text-studio-text">{uploadedPromptName}</span>
            </div>
            <button type="button" onClick={onClearPrompt} className="text-xs text-studio-muted hover:text-studio-live">Remove</button>
          </div>
        ) : (
          <div className="text-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs text-studio-accent hover:text-studio-accent-hover"
            >
              Upload custom prompt (.txt, .md)
            </button>
            <p className="text-[10px] text-studio-muted mt-1">Optional — overrides auto-generated instructions</p>
          </div>
        )}
        <input ref={fileRef} type="file" accept=".txt,.md" className="hidden" onChange={handleFileUpload} />
      </div>

      {/* Avatar */}
      <div>
        <label className="text-xs font-medium text-studio-muted block mb-1.5">Avatar</label>
        <AvatarPicker selected={avatar} onChange={onAvatarChange} slug={slug} />
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="flex-1 py-2.5 border border-studio-border rounded-lg text-sm text-studio-muted hover:text-studio-text transition-colors">Back</button>
        <button type="button" onClick={onNext} disabled={name.trim().length < 2} className="flex-1 py-2.5 bg-studio-accent hover:bg-studio-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">Next</button>
      </div>
    </div>
  );
}
