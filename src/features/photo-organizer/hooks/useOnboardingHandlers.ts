import { useCallback } from 'react';

import type { OnboardingState } from '../OnboardingModal';

interface UseOnboardingHandlersOptions {
  handleOnboardingCompleteInternal: (
    state: OnboardingState,
    reselectionProjectId?: string | null,
  ) => Promise<boolean>;
  clearPhotoHistory: () => void;
  resetSelection: () => void;
  setSelectedTreePath: (path: string | null) => void;
  setCurrentView: (view: string) => void;
}

export function useOnboardingHandlers({
  handleOnboardingCompleteInternal,
  clearPhotoHistory,
  resetSelection,
  setSelectedTreePath,
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
      setSelectedTreePath(null);
      setCurrentView('folders');
    },
    [
      clearPhotoHistory,
      handleOnboardingCompleteInternal,
      resetSelection,
      setCurrentView,
      setSelectedTreePath,
    ],
  );

  return {
    handleOnboardingComplete,
  };
}
