import React from 'react';

interface CardOption {
  id: string;
  label: string;
  desc: string;
  emoji: string;
}

interface CardSelectorProps {
  options: ReadonlyArray<CardOption>;
  selected: string;
  onChange: (id: string) => void;
  columns?: 2 | 3;
}

export function CardSelector({ options, selected, onChange, columns = 3 }: CardSelectorProps) {
  return (
    <div className={`grid gap-2 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`p-3 rounded-lg border text-center transition-all group ${
            selected === opt.id
              ? 'border-studio-accent bg-studio-accent/10'
              : 'border-studio-border hover:border-studio-accent/50 hover:bg-studio-card'
          }`}
        >
          <span className="text-lg block group-hover:scale-110 transition-transform">
            {opt.emoji}
          </span>
          <span className="text-xs text-studio-text font-medium block mt-1">{opt.label}</span>
          <span className="text-[10px] text-studio-muted block mt-0.5">{opt.desc}</span>
        </button>
      ))}
    </div>
  );
}
