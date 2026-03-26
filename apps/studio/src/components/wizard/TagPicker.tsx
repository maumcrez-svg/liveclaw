import React from 'react';

interface TagPickerProps {
  options: ReadonlyArray<{ id: string; label: string }>;
  selected: string[];
  onChange: (selected: string[]) => void;
  max: number;
  label: string;
  hint?: string;
}

export function TagPicker({ options, selected, onChange, max, label, hint }: TagPickerProps) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else if (selected.length < max) {
      onChange([...selected, id]);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-studio-muted">{label}</label>
        <span className="text-[10px] text-studio-muted">
          {selected.length}/{max}{hint ? ` — ${hint}` : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isSelected = selected.includes(opt.id);
          const isDisabled = !isSelected && selected.length >= max;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              disabled={isDisabled}
              className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                isSelected
                  ? 'bg-studio-accent/15 border border-studio-accent text-studio-accent'
                  : isDisabled
                  ? 'bg-studio-bg border border-studio-border/50 text-studio-muted/40 cursor-not-allowed'
                  : 'bg-studio-bg border border-studio-border text-studio-muted hover:border-studio-accent/50 hover:text-studio-text'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
