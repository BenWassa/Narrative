import { useCallback } from 'react';

import type { OnboardingState } from '../OnboardingModal';

interface UseOnboardingHandlersOptions {
  handleOnboardingCompleteInternal: (
    state: OnboardingState,
    reselectionProjectId?: string | null,
  ) => Promise<boolean>;
  clearPhotoHistory: () => void;
  resetSelection: () => void;
  setSelectedDay: (day: number | null) => void;
  setSelectedRootFolder: (folder: string | null) => void;
  setCurrentView: (view: string) => void;
}

export function useOnboardingHandlers({
  handleOnboardingCompleteInternal,
  clearPhotoHistory,
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

      clearPhotoHistory();
      resetSelection();
      setSelectedDay(null);
      setSelectedRootFolder(null);
      setCurrentView('folders');
    },
    [
      clearPhotoHistory,
      handleOnboardingCompleteInternal,
      resetSelection,
      setCurrentView,
      setSelectedDay,
      setSelectedRootFolder,
    ],
  );

  return {
    handleOnboardingComplete,
  };
}
