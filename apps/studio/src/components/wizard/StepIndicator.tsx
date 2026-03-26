import React from 'react';

interface StepIndicatorProps {
  current: number;
  total: number;
}

export function StepIndicator({ current, total }: StepIndicatorProps) {
  return (
    <div className="flex gap-1.5 justify-center mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i + 1 <= current
              ? 'bg-studio-accent w-6'
              : 'bg-studio-border w-1.5'
          }`}
        />
      ))}
    </div>
  );
}
