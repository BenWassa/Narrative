import { useState, useCallback, useRef } from 'react';

export interface ToastMessage {
  message: string;
  tone: 'info' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}

export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const clearToast = useCallback(() => {
    setToast(null);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (
      message: string,
      tone: 'info' | 'error' = 'info',
      options?: { durationMs?: number; actionLabel?: string; onAction?: () => void },
    ) => {
      setToast({ message, tone, actionLabel: options?.actionLabel, onAction: options?.onAction });
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      const durationMs = options?.durationMs ?? 2500;
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, durationMs);
    },
    [],
  );

  return {
    toast,
    showToast,
    clearToast,
  };
}
