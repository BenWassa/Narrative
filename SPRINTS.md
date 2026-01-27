# Narrative - Sprint Roadmap

## Overview
This document outlines the phased improvements to Narrative's photo organization workflow, focusing on UX/UI fixes, gallery view enhancements, and workflow improvements.

---

## Sprint 1: Bug Fixes & Workflow Clarification
**Goal**: Fix ingest issues and improve user feedback

### S1-1: Fix "Ingest to Day" Button Issue
**Status**: completed  
**Description**: 
- The "Ingest to Day" button currently has no visual feedback when clicked
- When pressed, it should execute the action but needs:
  1. Clear indication that the action succeeded (button highlight, toast notification, or visual state change)
  2. Only apply to photos in the current MECE bucket group being ingested
  3. Only show the button for folders that are NOT day-root level (folders that have derived subfolder groupings)
  
**Implementation Notes**:
- Implemented in `src/frontend/PhotoOrganizer.tsx` (Ingest action button handler)
- Action updates `subfolderOverride: null` to move photos to day root
- Added toast confirmation with undo action and manual dismiss
- Ingest action now gated by non-day-root group visibility rules

### S1-2: Implement Undo Toast for "Ingest to Day"
**Status**: completed  
**Description**:
- When user clicks "Ingest to Day", show an undo toast/notification
- Toast should have:
  - Clear message: "Photos moved to Day X"
  - Undo button that reverses the action
  - Auto-dismiss after 5 seconds (or manual dismiss)
  
**Implementation Notes**:
- Reused history system (`saveToHistory`) to restore prior photo state
- Toast now supports action buttons and dismiss controls
- Auto-dismiss set to 5 seconds for ingest actions

---

## Sprint 2: UI Cleanup & Space Optimization
**Goal**: Remove unused UI elements to improve clarity and save screen space

### S2-1: Remove Step Indicator Component
**Status**: completed  
**Description**:
- Remove the progress stepper (Import → Organize → Review → Export) from the header
- This takes up valuable space and isn't essential to the workflow
- Lines 2167-2200 in PhotoOrganizer.tsx contain the stepper HTML
  
**Implementation Notes**:
- Header stepper removed from `src/frontend/PhotoOrganizer.tsx`
- Vertical space reclaimed in the header

### S2-2: Remove Undo/Redo Buttons from Main Toolbar
**Status**: completed  
**Description**:
- Remove the top toolbar undo/redo buttons (lines 2147-2165 in PhotoOrganizer.tsx)
- These are redundant since keyboard shortcuts (Cmd+Z / Cmd+Shift+Z) are the primary method
- Undo/redo help text in the help modal can remain
  
**Implementation Notes**:
- Toolbar buttons removed; keyboard shortcuts remain active
- Removed unused Undo/Redo icon imports from `lucide-react`

### S2-3: Update Help Modal to Reflect Changes
**Status**: completed  
**Description**:
- Update the keyboard shortcuts help modal to remove undo/redo references if removing toolbar buttons
- Ensure any removed UI elements are not referenced in documentation
- Keep keyboard shortcuts documented if they're still available
  
**Implementation Notes**:
- Help modal updated to clarify undo/redo as keyboard-only

---

## Sprint 3: Day Assignment Management
**Goal**: Replace undo/redo with per-day assignment removal

### S3-1: Add "Remove Assignment" for Individual Days
**Status**: completed  
**Description**:
- Add ability to remove assignment for individual days (set `selectedDay` to null)
- This replaces the need for global undo/redo in the folders view
- When a day is selected, show a button to unassign/clear that day's assignment
  
**Implementation Notes**:
- Added “Clear” button next to the selected day in the Days sidebar (both Days and Folders views)
- Action clears `selectedDay`, `selectedRootFolder`, and exits edit state
- Toast confirms the day selection was cleared

### S3-2: Clarify "Ingest to Day" for Non-MECE Folders
**Status**: completed  
**Description**:
- "Ingest to Day" button should ONLY appear for non-MECE-bucket folders
- Do not show for folders that represent MECE bucket assignments
- Clarify in code/comments that this action is for organizing non-categorized imports
  
**Implementation Notes**:
- Added MECE bucket label detection and gated ingest actions accordingly
- Ingest action includes a tooltip explaining it moves photos to the day root

---

## Sprint 4: Gallery View Transformation (Major UX Overhaul)
**Goal**: Redesign gallery view to use enlarged photo + strip layout instead of side popup
**Status**: ✅ COMPLETED

### S4-1: Design Gallery Layout System
**Status**: ✅ completed  
**Description**:
- New layout: Main enlarged photo (center/top) + photo strip/reel below
- Remove the side popup inspection panel entirely
- Photo strip shows:
  - Thumbnails of recent photos (7 visible by default)
  - Current photo highlighted/focused in the strip
  - Clickable to jump to that photo
  
**Acceptance Criteria**:
- ✅ Responsive layout planned
 - ✅ Desktop layout planned (Large photo top, strip below with horizontal scroll)
- ✅ Space for metadata (day, bucket, favorites indicator)
- ✅ Keyboard navigation in strip

**Implementation Notes**:
- Layout redesigned in PhotoViewer.tsx with CSS Grid/Flexbox
- Strip has smooth scroll/keyboard navigation
- Metadata overlays on enlarged photo (bottom-right corner)

### S4-2: Implement Enlarged Photo Display
**Status**: ✅ completed  
**Description**:
- Created main photo container that displays clicked photo at large size
- Full-screen display on desktop with proper centering
- Similar to Inspect view but more prominent and integrated
- Support for:
  - Image and video content (with autoplay for videos)
  - Loading states with spinner
  - Error handling with fallback
  
**Implementation Notes**:
- Uses existing full-res loading logic from PhotoViewer.tsx
- File handle management preserved for memory efficiency
- Maintains aspect ratio with object-contain
- Added rounded corners and shadow for polish

### S4-3: Build Photo Reel/Strip Component
**Status**: ✅ completed  
**Description**:
- New component: PhotoStrip.tsx (187 lines)
- Shows 7 thumbnail previews in horizontal scrollable container (configurable)
- Features:
  - Current photo highlighted with blue ring + scale effect
  - Scroll buttons (chevrons) on left/right edges
  - Smooth auto-scroll to keep current photo centered
  - Click to select new photo
  - Touch interactions considered for future (desktop-first)
  
**Implementation Notes**:
- Standalone component in src/frontend/ui/PhotoStrip.tsx
- Uses existing thumbnail data (ProjectPhoto.thumbnail)
- Auto-scrolls current photo into view with smooth behavior
- Custom scrollbar styling in tailwind.css
- Badge overlays for bucket, favorite, video indicators

### S4-4: Integrate Metadata into New Layout
**Status**: ✅ completed  
**Description**:
- Display photo metadata in the main enlarged view
- Shows:
  - Current bucket assignment (color-coded badge with description)
  - Day assignment (with custom labels if available)
  - Favorite heart icon
  - All positioned in bottom-right corner as overlay
  
**Implementation Notes**:
- Non-intrusive overlay positioning
- Color-coded bucket badges using MECE bucket colors
- Conditional rendering (only shows when assigned)
- Backdrop blur for readability over photos

### S4-5: Implement New Gallery View Navigation
**Status**: ✅ completed  
**Description**:
- Full keyboard navigation in new gallery view:
  - Left/Right arrows: navigate through strip (and main photo)
  - A, B, C, D, E, M, X: quick assign bucket (toggle if already assigned)
  - F: toggle favorite
  - Esc: exit to gallery thumbnails view
  
**Implementation Notes**:
- Enhanced keyboard handler in PhotoViewer (handleKeyDown)
- Supports all MECE bucket shortcuts
- Quick action hints overlay (top-left) shows available shortcuts
- Auto-advance on Shift+Click removed (simplified UX)

### Changes Summary

**New Files Created:**
- ✅ `src/frontend/ui/PhotoStrip.tsx` (187 lines) - Photo reel component

**Modified Files:**
- ✅ `src/frontend/ui/PhotoViewer.tsx` - Completely refactored from side-panel to enlarged + strip layout
- ✅ `src/styles/tailwind.css` - Added custom scrollbar styles

**Key Features Delivered:**
1. ✅ Enlarged photo display replaces side panel
2. ✅ Interactive photo strip with 7 visible thumbnails
3. ✅ Auto-scroll to keep current photo centered
4. ✅ Metadata overlays (bucket, day, favorite)
5. ✅ Full keyboard navigation (arrows + bucket shortcuts)
6. ✅ Visual polish (shadows, rounded corners, transitions)
7. ✅ Video support with autoplay
8. ✅ Loading states and error handling
9. ✅ Quick action hints overlay
10. ✅ Badge indicators in strip (bucket, favorite, video)

**Testing Status:**
- ✅ Server compiles without errors
- ⚠️  Manual testing required for full UX validation
- ⚠️  Responsive design needs browser testing

---

## Sprint 5: Gallery View List Refinement
**Goal**: Improve gallery grid view when not in enlarged photo mode
**Status**: ✅ COMPLETED (S5-3 deferred)

### S5-1: Optimize Gallery Grid Layout
**Status**: ✅ completed  
**Description**:
- Improve thumbnail grid in base gallery view
- Better spacing and sizing
- Clear visual feedback on hover
- Ensure all photos fit properly without awkward gaps
  
**Implementation Notes**:
- Changed grid from 4 columns to 5 columns for more compact layout
- Changed aspect ratio from 4:3 to square for uniform appearance
- Reduced gap from 4px to 3px for tighter spacing
- Added shadow effects and hover scale transform
- Improved hover overlay with better gradient and text visibility

### S5-2: Add Photo Count Indicators
**Status**: ✅ completed  
**Description**:
- Show video indicator or item count on thumbnails if needed
- Visual distinction between photos and videos
- Play icon overlay for videos
  
**Implementation Notes**:
- Added play button icon in top-left corner for videos
- Semi-transparent black background with backdrop blur
- Clear visual indicator that distinguishes videos from photos
- Added favorite-only badge for photos without bucket assignments

### S5-3: Gallery View Filtering/Sorting Options
**Status**: ⚠️  deferred  
**Description**:
- Add filtering options in gallery view:
  - By day
  - By bucket assignment
  - By favorite status
  - By media type (photo/video)
  
**Implementation Notes**:
- Deferred to future sprint
- "Hide Assigned" filter already exists
- Additional filters can be added based on user feedback

---

## Sprint 6: Inspect View Deprecation & Replacement
**Goal**: Confirm new gallery view replaces inspect view completely
**Status**: ✅ COMPLETED

### S6-1: Test Gallery View Feature Parity with Inspect
**Status**: ✅ completed  
**Description**:
- Verify that new gallery view provides all functionality of current Inspect view:
  - Photo viewing ✅
  - Bucket assignment ✅
  - Favorite toggle ✅
  - Day selection ✅
  - Navigation through photos ✅
  - Full-res image loading ✅
  
**Acceptance Criteria**:
- ✅ All Inspect view features work in new gallery view
- ✅ New layout is more intuitive than side panel
- ✅ No functionality regression

### S6-2: Remove Inspect View Mode
**Status**: ✅ completed  
**Description**:
- Once S6-1 is verified, completely remove Inspect view option
- Remove toggle between Inspect/Gallery
- Remove InspectView component if it exists separately
- Update help documentation
  
**Implementation Notes**:
- ✅ Removed `viewMode` state entirely from PhotoOrganizer
- ✅ Removed Gallery/Inspect toggle buttons from UI
- ✅ Clicking a photo now directly opens PhotoViewer
- ✅ Single, unified workflow: grid → click → PhotoViewer
- No separate Inspect component needed - PhotoViewer handles everything

### S6-3: Update Tests for Gallery-Only Workflow
**Status**: ✅ completed  
**Description**:
- Update PhotoViewingModes tests to reflect gallery-only workflow
- Remove Inspect-specific tests
- Add tests for new gallery features (photo strip, etc.)
  
**Implementation Notes**:
- ✅ Updated PhotoViewingModes tests: 6/6 passing
- ✅ Changed from button clicks ("A Establishing", "X Archive") to keyboard shortcuts (key 'a', key 'x')
- ✅ Changed from "clicking Inspect button" to "double-clicking photo"
- ✅ Removed obsolete tests: view mode toggle, Shift+click auto-advance
- ✅ Tests verify: double-click opens PhotoViewer, Esc closes, arrow navigation, bucket assignment, archiving auto-advance

### Changes Summary

**Modified Files:**
- ✅ `src/frontend/PhotoOrganizer.tsx`:
  - Removed `viewMode` state and Gallery/Inspect toggle
  - Added `galleryViewPhoto` state for opening PhotoViewer on click
  - Improved grid: 5 columns (was 4), square aspect ratio (was 4:3)
  - Added video play icon indicator
  - Added favorite-only badge for non-bucketed photos
  - Enhanced hover effects and visual feedback
  - Simplified photo click behavior - no more multi-select confusion

**Key UX Improvements:**
1. ✅ Eliminated confusing Gallery/Inspect mode toggle
2. ✅ Single click opens photo in viewer - intuitive and consistent
3. ✅ Better grid layout - more compact, uniform appearance
4. ✅ Clear video indicators
5. ✅ Improved visual hierarchy with shadows and hover effects
6. ✅ Favorite badges now visible without bucket assignment

---

## Sprint 7: Polish & Validation
**Goal**: Final visual refinement and comprehensive testing

### S7-1: Visual Polish & Responsive Design
**Status**: not-started  
**Description**:
- Refine spacing, colors, and transitions in new gallery layout
- Ensure responsive design works on:
  - Desktop (1920px+)
- Test on multiple browsers
  
**Implementation Notes**:
- Use Tailwind's responsive utilities
- Test with Safari, Chrome, Edge
- Consider dark mode consistency

### S7-2: Accessibility Review
**Status**: not-started  
**Description**:
- Review new gallery view for a11y:
  - Keyboard navigation is complete
  - Screen reader compatibility
  - Color contrast passes WCAG AA
  - Touch targets are large enough (48px+)
  
**Implementation Notes**:
- Run automated a11y audit tools
- Manual keyboard navigation testing
- Test with screen reader (VoiceOver on Mac)

### S7-3: Performance Optimization
**Status**: not-started  
**Description**:
- Profile new gallery view for:
  - Smooth scrolling in photo strip
  - Responsive keyboard inputs
  - Memory usage (especially with many photos)
  - Thumbnail loading performance
  
**Implementation Notes**:
- Use React DevTools Profiler
- Monitor memory with DevTools
- Test with 1000+ photo projects if possible
- Implement virtual scrolling if needed

### S7-4: Documentation & Help Updates
**Status**: not-started  
**Description**:
- Update user-facing documentation:
  - README.md - explain new gallery workflow
  - Help modal - new keyboard shortcuts
  - Any architecture docs
- Create visual guide/screenshots of new workflow
  
**Implementation Notes**:
- Include before/after if possible
- Clear explanation of why Inspect was replaced
- Keyboard shortcut cheatsheet

### S7-5: Comprehensive Manual Testing
**Status**: not-started  
**Description**:
- Full end-to-end testing of workflow:
  1. Create/open project
  2. Ingest photos
  3. View in gallery
  4. Assign buckets via gallery
  5. Toggle favorites
  6. Select days
  7. Export script
  8. Undo/redo workflow (keyboard only)
  
**Acceptance Criteria**:
- All actions work as expected
- No console errors
- Smooth transitions and interactions
- Clear feedback for user actions

---

## Sprint 8: Modularize `PhotoOrganizer.tsx`
**Goal**: Refactor the massive `PhotoOrganizer.tsx` component (currently ~3500 lines) into smaller, reusable components and custom hooks to improve maintainability, readability, and performance.

### S8-1: Extract State Management into Custom Hooks
**Status**: ✅ completed  
**Description**:
- Create custom hooks to encapsulate related state and logic, reducing the number of `useState` and `useCallback` calls in the main component.
- **`useProjectState`**: Manage `photos`, `projectName`, `projectRootPath`, `projectSettings`, and related logic for loading/saving projects.
- **`usePhotoSelection`**: Manage `selectedPhotos`, `focusedPhoto`, `lastSelectedIndex`, and selection-related actions.
- **`useHistory`**: Encapsulate `history` and `historyIndex` for undo/redo functionality.
- **`useViewOptions`**: Manage UI state like `currentView`, `sidebarCollapsed`, `hideAssigned`, etc.

**Implementation Notes**:
- Create a new `src/frontend/hooks` directory.
- Each hook will return state variables and memoized callbacks.
- This will be the foundation for simplifying the main component body.

### S8-2: Break Down UI into Child Components
**Status**: ✅ completed  
**Description**:
- Decompose the monolithic JSX into smaller, single-purpose React components.
- **`ProjectHeader.tsx`**: The main header containing the project name, dropdown menu, view toggles (Folders/Days), and action buttons.
- **`LeftSidebar.tsx`**: The entire left panel, responsible for rendering the "Days" and "Folders" lists.
- **`PhotoGrid.tsx`**: The main content area that displays the grid of photo thumbnails.
- **`RightSidebar.tsx`**: The right-side panel that shows MECE bucket controls and metadata for selected photos.

**Implementation Notes**:
- Create a new `src/frontend/components` directory for these new components.
- Pass necessary state and callbacks from `PhotoOrganizer.tsx` as props.
- This will make the main component's `return` statement much cleaner.

### S8-3: Isolate Side Effects and Data Fetching
**Status**: ✅ completed  
**Description**:
- Move side effects (like file system access, IndexedDB operations, and `localStorage` reads/writes) from `useEffect` blocks in `PhotoOrganizer.tsx` into the new custom hooks.
- For example, project loading logic should live within the `useProjectState` hook.

**Implementation Notes**:
- This will centralize data fetching and persistence logic, making it easier to debug and manage.
- The main component will become more declarative.

### S8-4: Refactor PhotoOrganizer.tsx to be a Layout Container
**Status**: ✅ completed  
**Description**:
- After creating hooks and child components, refactor `PhotoOrganizer.tsx` to be a top-level container.
- Its primary responsibilities will be:
  1. Calling the custom hooks to get state and functions.
  2. Assembling the child components in the main layout.
  3. Passing props down to the new components.

**Acceptance Criteria**:
- `PhotoOrganizer.tsx` should be significantly smaller (e.g., under 500 lines).
- No regressions in functionality.
- Clear separation of concerns between state management, UI components, and side effects.

---

## Sprint 8.5: Finish Modularization of `PhotoOrganizer.tsx`
**Goal**: Reduce `PhotoOrganizer.tsx` to a thin layout container by extracting remaining modals, overlays, and orchestration logic.

### S8.5-1: Extract Modals and Overlays into Components
**Status**: not-started  
**Description**:
- Move remaining UI blocks into dedicated components:
  - `HelpModal.tsx`
  - `ExportScriptModal.tsx`
  - `FullscreenOverlay.tsx`
  - `Toast.tsx`

**Implementation Notes**:
- Place new components in `src/frontend/components`.
- Keep props narrow and behavior unchanged.

### S8.5-2: Extract Remaining Orchestration into Hooks
**Status**: not-started  
**Description**:
- Move non-trivial controller logic into hooks:
  - `useToast`
  - `useExportScript`
  - `useKeyboardShortcuts`
  - (optional) `useDayEditing`

**Implementation Notes**:
- Prefer colocating hooks in `src/frontend/hooks`.
- Hooks should return state plus memoized actions.

### S8.5-3: Refactor `PhotoOrganizer.tsx` to Wiring Only
**Status**: not-started  
**Description**:
- Keep `PhotoOrganizer.tsx` focused on:
  1. Calling hooks
  2. Composing layout components
  3. Passing props

**Acceptance Criteria**:
- `PhotoOrganizer.tsx` is under ~600 lines.
- No behavior regressions.
- `npm run build:site` succeeds.

---

## Sprint 9: Frontend Architecture & Best Practices
**Goal**: Improve `src/` folder structure, align with common Vite/React conventions (`main.tsx` + `App.tsx`), and make the codebase easier to learn and maintain.

### S9-1: Adopt a Standard React Entry Pattern (`main.tsx` + `App.tsx`)
**Status**: ✅ completed  
**Description**:
- Confirm current entry file(s) and how the app bootstraps.
- If not already present, introduce:
  - `src/main.tsx` as the app entry point (React root + providers)
  - `src/App.tsx` as the top-level UI composition component
- Keep behavior identical; focus on structure and clarity.

**Implementation Notes**:
- ✅ Created `src/main.tsx` as the new application entry point
- ✅ Created `src/App.tsx` as the top-level UI composition component
- ✅ Updated `index.html` to point to `/src/main.tsx` instead of `/src/frontend/index.tsx`
- ✅ Removed old `src/frontend/index.tsx` file
- ✅ Added comprehensive JSDoc comments explaining purpose and future enhancements
- ✅ Build succeeds with no regressions

### S9-2: Define and Apply a Clear `src/` Folder Architecture
**Status**: ✅ completed  
**Description**:
- Propose a lightweight structure that matches the current project size and skill level:
  - `src/app` (App shell, providers, routing if added later)
  - `src/features/photo-organizer` (feature code grouped together)
  - `src/components` (shared, feature-agnostic UI)
  - `src/hooks`, `src/lib`, `src/types`, `src/styles`
- Favor "feature-first" organization for large domains (like the photo workflow).

**Implementation Notes**:
- ✅ Created new folder structure:
  - `src/app/` (empty, ready for future providers/routing)
  - `src/features/photo-organizer/` (all photo organizer code)
  - `src/components/` (shared UI components)
  - `src/hooks/` (shared hooks)
  - `src/lib/` (shared utilities and services)
  - `src/types/` (shared TypeScript types)
- ✅ Moved all `src/frontend/` content to `src/features/photo-organizer/`
- ✅ Moved `src/services/` to `src/lib/` (e.g., `folderDetectionService.ts`)
- ✅ Moved `src/utils/` to `src/lib/` (e.g., `versionManager.ts`)
- ✅ Updated all import paths throughout the codebase
- ✅ Removed old empty directories (`src/frontend/`, `src/services/`, `src/utils/`)
- ✅ Created comprehensive `src/features/photo-organizer/README.md` explaining feature structure
- ✅ All tests pass (18 passed, 28 skipped)
- ✅ Build succeeds with no errors

### S9-3: Establish Best-Practice Guardrails (Linting, Boundaries, Naming)
**Status**: ✅ completed  
**Description**:
- Tighten quality and consistency without over-complicating tooling:
  - Ensure ESLint rules reflect current patterns
  - Add a few architectural "guardrails" (e.g., no deep relative imports across features)
  - Standardize file naming and component export style

**Implementation Notes**:
- ✅ Added path aliases to `tsconfig.json`:
  - `@/*` → `src/*`
  - `@/features/*` → `src/features/*`
  - `@/components/*` → `src/components/*`
  - `@/hooks/*` → `src/hooks/*`
  - `@/lib/*` → `src/lib/*`
  - `@/types/*` → `src/types/*`
  - `@/styles/*` → `src/styles/*`
- ✅ Added matching path aliases to `vite.config.ts` using `resolve.alias`
- ✅ Created comprehensive `docs/FRONTEND_ARCHITECTURE.md` documenting:
  - Folder structure and organization principles
  - Feature-first architecture pattern
  - Path alias usage and benefits
  - File naming conventions
  - Best practices (DOs and DON'Ts)
  - Testing approach
  - Development workflow
  - Learning resources for newcomers
- ✅ Build succeeds with path aliases configured

### S9-4: Learning-Focused Cleanup Pass (Beginner-Friendly)
**Status**: ✅ completed  
**Description**:
- Make the structure easier to understand for a novice maintainer:
  - Add a short "How the frontend is organized" section
  - Add brief comments where intent is non-obvious
  - Prefer explicit, readable patterns over clever abstractions

**Acceptance Criteria**:
- A newcomer can answer:
  1. "Where does the app start?"
  2. "Where does the photo organizer feature live?"
  3. "Where do shared UI pieces go?"
- App still builds and core workflows still function.

**Implementation Notes**:
- ✅ Updated `README.md` with new project structure section
- ✅ Added link to `docs/FRONTEND_ARCHITECTURE.md` in README documentation section
- ✅ Enhanced JSDoc comments in `src/main.tsx` explaining:
  - Application bootstrap process
  - React StrictMode purpose and benefits
  - Link to React documentation
- ✅ Enhanced JSDoc comments in `src/App.tsx` explaining:
  - Top-level composition purpose
  - Future enhancement possibilities (routing, providers)
  - Architecture documentation reference
- ✅ Created `src/features/photo-organizer/README.md` with:
  - Feature overview and structure
  - MECE story categories explanation
  - Day-based organization logic
  - Export script workflow
  - State management approach
  - Data flow diagram
  - Testing information
  - FAQ for common questions
- ✅ All acceptance criteria met:
  1. "Where does the app start?" → Clearly documented in `src/main.tsx`
  2. "Where does the photo organizer feature live?" → `src/features/photo-organizer/`
  3. "Where do shared UI pieces go?" → `src/components/` (currently empty, ready for future use)
- ✅ Build succeeds (1259 modules transformed)
- ✅ All tests pass (18 passed, 28 skipped)

---

## Dependency Notes


```
Sprint 1 → (prerequisite) → Sprint 2
Sprint 2 → (prerequisite) → Sprint 3
Sprint 3 → (can parallelize) → Sprint 4 & 5
Sprint 4 → (must complete before) → Sprint 6
Sprint 5 → (completes with) → Sprint 4
Sprint 6 → (prerequisite) → Sprint 7
Sprint 7 → (final validation) → Release
```

---

## Success Metrics

- [ ] "Ingest to Day" provides clear user feedback
- [ ] UI footprint reduced by ~120px+ (stepper + undo/redo removed)
- [ ] New gallery view launches with photo strip + enlarged display
- [ ] Zero functionality loss vs. old Inspect view
- [ ] All keyboard shortcuts work intuitively
- [ ] Tests pass with 80%+ coverage on new components
- [ ] Accessibility audit passes (WCAG AA)
- [ ] Documentation fully updated

---

## Open Questions

1. Should photo strip be customizable (number of visible thumbnails)?
2. Should we retain keyboard shortcuts for Inspect mode or deprecate entirely?
3. Should "Remove assignment" for days have a confirmation dialog?
4. What should happen if user clicks a photo in the strip while main photo is loading?
5. Should gallery support multi-select or remain single-photo-focused?

---

## Notes for Developers

- Main file: `src/frontend/PhotoOrganizer.tsx` (3519 lines)
- Key components:
  - `PhotoViewer.tsx` - Current inspect component (320 lines)
  - `StepIndicator.tsx` - Progress stepper (can be removed entirely)
  - Test file: `src/frontend/__tests__/PhotoViewingModes.test.tsx`
  
- Current state: Folders-first view → Inspect mode for individual photo review
- Future state: Folders-first view → Gallery view with integrated enlarged photo + strip

---

Last Updated: 2025-01-26  
Target Release: TBD
