import { useCallback } from 'react';

import type { OnboardingState } from '../OnboardingModal';

interface UseOnboardingHandlersOptions {
  handleOnboardingCompleteInternal: (
    state: OnboardingState,
    reselectionProjectId?: string | null,
  ) => Promise<boolean>;
  setHistory: (history: unknown[]) => void;
  setHistoryIndex: (index: number) => void;
  resetSelection: () => void;
  setSelectedDay: (day: number | null) => void;
  setSelectedRootFolder: (folder: string | null) => void;
  setCurrentView: (view: string) => void;
}

export function useOnboardingHandlers({
  handleOnboardingCompleteInternal,
  setHistory,
  setHistoryIndex,
  resetSelection,
  setSelectedDay,
  setSelectedRootFolder,
  setCurrentView,
}: UseOnboardingHandlersOptions) {
  const handleOnboardingComplete = useCallback(
    async (state: OnboardingState, reselectionProjectId?: string | null) => {
      const success = await handleOnboardingCompleteInternal(state, reselectionProjectId);
      if (!success) {
        return;
      }

      setHistory([]);
      setHistoryIndex(-1);
      resetSelection();
      setSelectedDay(null);
      setSelectedRootFolder(null);
      setCurrentView('folders');
    },
    [
      handleOnboardingCompleteInternal,
      resetSelection,
      setCurrentView,
      setHistory,
      setHistoryIndex,
      setSelectedDay,
      setSelectedRootFolder,
    ],
  );

  return {
    handleOnboardingComplete,
  };
}
