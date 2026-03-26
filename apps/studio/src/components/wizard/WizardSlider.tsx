import React from 'react';

interface WizardSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  lowLabel?: string;
  highLabel?: string;
  showValue?: boolean;
  formatValue?: (v: number) => string;
  onChange: (value: number) => void;
}

export function WizardSlider({
  value, min, max, step, label, lowLabel, highLabel,
  showValue = true, formatValue, onChange,
}: WizardSliderProps) {
  const display = formatValue ? formatValue(value) : String(value);
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-studio-muted">{label}</label>
        {showValue && (
          <span className="text-xs text-studio-accent font-mono">{display}</span>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #ff6b00 0%, #ff6b00 ${pct}%, #2d2d35 ${pct}%, #2d2d35 100%)`,
        }}
      />
      {(lowLabel || highLabel) && (
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-studio-muted">{lowLabel}</span>
          <span className="text-[10px] text-studio-muted">{highLabel}</span>
        </div>
      )}
    </div>
  );
}
