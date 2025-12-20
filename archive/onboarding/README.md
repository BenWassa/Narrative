Archived onboarding flow

Status:
- These files represent the previous, feature-rich onboarding flow (folder detection, dry-run, script export, and apply).
- The project pivoted to a simpler onboarding that only collects project name and folder path, without changing folder architecture.
- The code and tests were archived for potential future reference and to avoid breaking changes during the refactor.

Why archived:
- Browser security limitations prevent reliable filesystem path access and in-place folder operations.
- The current UX goal is a lightweight setup that opens a project and starts organizing photos.

What is included:
- Legacy UI components (OnboardingModal, StartScreen).
- Folder detection and file system helper services.
- Related tests.
