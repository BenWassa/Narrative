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
    <div className="flex items-center">
      {steps.map((s, i) => {
        const status = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'upcoming';
        return (
          <div key={s.key} className="flex items-center">
            <div className="flex items-center">
              <div
                aria-current={status === 'active' ? 'step' : undefined}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  status === 'done'
                    ? 'bg-green-200 text-green-800 border border-green-300'
                    : status === 'active'
                    ? 'bg-sky-100 text-sky-800 ring-1 ring-sky-200'
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}
              >
                {status === 'done' ? <Check className="w-4 h-4 text-green-800" /> : <span>{i + 1}</span>}
              </div>

              <div className={`ml-3 text-sm ${status === 'active' ? 'text-sky-800 font-medium' : 'text-gray-500'}`}>
                {s.label}
              </div>
            </div>

            {i !== steps.length - 1 && <div aria-hidden className="w-8 h-px bg-gray-200 mx-4" />}
          </div>
        );
      })}
    </div>
  );
}
