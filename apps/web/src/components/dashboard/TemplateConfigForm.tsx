'use client';

import { useState } from 'react';
import type { ConfigField } from '@/lib/agent-templates';

// Dot-path helpers
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const result = { ...obj };
  const keys = path.split('.');
  let current: Record<string, unknown> = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    current[key] = current[key] && typeof current[key] === 'object'
      ? { ...(current[key] as Record<string, unknown>) }
      : {};
    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
  return result;
}

interface TemplateConfigFormProps {
  fields: ConfigField[];
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput('');
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 bg-claw-accent/20 text-claw-accent text-xs px-2 py-0.5 rounded">
            {tag}
            <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} className="hover:text-white">&times;</button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
        placeholder={placeholder}
        className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
      />
    </div>
  );
}

export default function TemplateConfigForm({ fields, config, onChange }: TemplateConfigFormProps) {
  const setValue = (key: string, value: unknown) => {
    onChange(setNestedValue(config, key, value));
  };

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const currentValue = getNestedValue(config, field.key);

        return (
          <div key={field.key}>
            <label className="block text-sm font-medium mb-1">{field.label}</label>

            {field.type === 'text' && (
              <input
                type="text"
                value={(currentValue as string) ?? field.default ?? ''}
                onChange={(e) => setValue(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
              />
            )}

            {field.type === 'textarea' && (
              <textarea
                value={(currentValue as string) ?? field.default ?? ''}
                onChange={(e) => setValue(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
              />
            )}

            {field.type === 'number' && (
              <input
                type="number"
                value={(currentValue as number) ?? field.default ?? ''}
                onChange={(e) => setValue(field.key, Number(e.target.value))}
                placeholder={field.placeholder}
                className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
              />
            )}

            {field.type === 'select' && (
              <select
                value={(currentValue as string) ?? field.default ?? ''}
                onChange={(e) => setValue(field.key, e.target.value)}
                className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
              >
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}

            {field.type === 'tags' && (
              <TagInput
                value={Array.isArray(currentValue) ? (currentValue as string[]) : (Array.isArray(field.default) ? (field.default as string[]) : [])}
                onChange={(v) => setValue(field.key, v)}
                placeholder={field.placeholder}
              />
            )}

            {field.helpText && (
              <p className="text-xs text-claw-text-muted mt-1">{field.helpText}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
