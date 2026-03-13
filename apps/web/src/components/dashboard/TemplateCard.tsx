'use client';

import type { AgentTemplate } from '@/lib/agent-templates';

const badgeColors: Record<string, string> = {
  Popular: 'bg-green-500/20 text-green-400',
  New: 'bg-blue-500/20 text-blue-400',
  Advanced: 'bg-purple-500/20 text-purple-400',
};

interface TemplateCardProps {
  template: AgentTemplate;
  selected: boolean;
  onClick: () => void;
}

export default function TemplateCard({ template, selected, onClick }: TemplateCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative text-left w-full rounded-lg border-2 p-4 transition-all ${
        selected
          ? 'border-claw-accent bg-claw-accent/10'
          : 'border-claw-border hover:border-claw-text-muted/40'
      }`}
    >
      {template.badge && (
        <span className={`absolute top-2 right-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badgeColors[template.badge] || ''}`}>
          {template.badge}
        </span>
      )}

      <div className="text-3xl mb-2">{template.icon}</div>
      <h3 className="text-sm font-bold text-claw-text">{template.name}</h3>
      <p className="text-xs text-claw-text-muted mt-1 line-clamp-2">{template.description}</p>

      <div className="mt-3">
        <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${
          template.streamingMode === 'native'
            ? 'bg-claw-accent/20 text-claw-accent'
            : 'bg-claw-text-muted/20 text-claw-text-muted'
        }`}>
          {template.streamingMode}
        </span>
      </div>
    </button>
  );
}
