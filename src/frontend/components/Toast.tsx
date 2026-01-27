import React from 'react';
import { X } from 'lucide-react';

export interface ToastMessage {
  message: string;
  tone: 'info' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export default function Toast({ toast, onDismiss }: ToastProps) {
  if (!toast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div
        className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm shadow-lg ${
          toast.tone === 'error' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-100'
        }`}
        role="status"
        aria-live="polite"
      >
        <span>{toast.message}</span>
        <div className="flex items-center gap-2">
          {toast.actionLabel && (
            <button
              onClick={() => {
                toast.onAction?.();
                onDismiss();
              }}
              className="px-2 py-0.5 rounded bg-white/10 text-xs text-white hover:bg-white/20"
            >
              {toast.actionLabel}
            </button>
          )}
          <button
            onClick={onDismiss}
            className="p-1 rounded hover:bg-white/10"
            aria-label="Dismiss toast"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
