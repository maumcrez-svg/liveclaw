import React from 'react';

interface Template {
  id: string;
  img: string;
  name: string;
  type: string;
  desc: string;
  configFields: Array<{ key: string; label: string; placeholder: string }>;
}

interface StepTemplateProps {
  templates: Template[];
  onSelect: (templateId: string) => void;
}

export function StepTemplate({ templates, onSelect }: StepTemplateProps) {
  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-lg font-semibold text-studio-text text-center mb-1">What kind of agent?</h2>
      <p className="text-sm text-studio-muted text-center mb-5">Pick a starting point. You can customize everything later.</p>
      <div className="grid grid-cols-3 gap-2.5">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className="p-3 rounded-xl border border-studio-border hover:border-studio-accent hover:bg-studio-accent/5 text-center transition-all group"
          >
            <img src={t.img} alt={t.name} className="w-14 h-14 mx-auto mb-1.5 group-hover:scale-110 transition-transform" draggable={false} />
            <span className="text-xs text-studio-text font-medium block">{t.name}</span>
            <span className="text-[10px] text-studio-muted block mt-0.5">{t.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
