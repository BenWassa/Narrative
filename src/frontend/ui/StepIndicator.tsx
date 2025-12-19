import React from 'react';
import { Check } from 'lucide-react';

interface Step {
  key: string;
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentKey: string;
}

export default function StepIndicator({ steps, currentKey }: StepIndicatorProps) {
  const currentIndex = steps.findIndex(s => s.key === currentKey);

  return (
    <div className="flex items-center gap-6">
      {steps.map((s, i) => {
        const status = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'upcoming';
        return (
          <div key={s.key} className="flex items-center gap-3">
            <div
              aria-current={status === 'active' ? 'step' : undefined}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                status === 'done' ? 'bg-green-500 text-white' : status === 'active' ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-300'
              }`}
            >
              {status === 'done' ? <Check className="w-4 h-4" /> : <span>{i + 1}</span>}
            </div>
            <div className="text-xs text-gray-400">
              <div className={`font-medium ${status === 'active' ? 'text-gray-100' : ''}`}>{s.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
