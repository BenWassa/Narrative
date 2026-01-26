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

### S5-1: Optimize Gallery Grid Layout
**Status**: not-started  
**Description**:
- Improve thumbnail grid in base gallery view
- Better spacing and sizing
- Clear visual feedback on hover
- Ensure all photos fit properly without awkward gaps
  
**Implementation Notes**:
- This is the view that shows when NOT in enlarged photo mode
- Grid should be responsive and use full available space
- Consider CSS Grid with auto-fit/auto-fill

### S5-2: Add Photo Count Indicators
**Status**: not-started  
**Description**:
- Show video indicator or item count on thumbnails if needed
- Visual distinction between photos and videos
- Play icon overlay for videos
  
**Implementation Notes**:
- Videos should be clearly marked
- Small overlay or corner badge

### S5-3: Gallery View Filtering/Sorting Options
**Status**: not-started  
**Description**:
- Add filtering options in gallery view:
  - By day
  - By bucket assignment
  - By favorite status
  - By media type (photo/video)
  
**Implementation Notes**:
- Simple filter buttons or dropdown
- Should persist selection while in gallery view
- Reset when exiting gallery

---

## Sprint 6: Inspect View Deprecation & Replacement
**Goal**: Confirm new gallery view replaces inspect view completely

### S6-1: Test Gallery View Feature Parity with Inspect
**Status**: not-started  
**Description**:
- Verify that new gallery view provides all functionality of current Inspect view:
  - Photo viewing
  - Bucket assignment
  - Favorite toggle
  - Day selection
  - Navigation through photos
  - Full-res image loading
  
**Acceptance Criteria**:
- All Inspect view features work in new gallery view
- New layout is more intuitive than side panel
- No functionality regression

### S6-2: Remove Inspect View Mode
**Status**: not-started  
**Description**:
- Once S6-1 is verified, completely remove Inspect view option
- Remove toggle between Inspect/Gallery
- Remove InspectView component if it exists separately
- Update help documentation
  
**Implementation Notes**:
- This is a breaking change - ensure new gallery view is solid first
- Remove all references to "Inspect mode"
- Update help modal to reflect gallery-only workflow

### S6-3: Update Tests for Gallery-Only Workflow
**Status**: not-started  
**Description**:
- Update PhotoViewingModes tests to reflect gallery-only workflow
- Remove Inspect-specific tests
- Add tests for new gallery features (photo strip, etc.)
  
**Implementation Notes**:
- Tests are in `src/frontend/__tests__/PhotoViewingModes.test.tsx`
- Ensure test coverage for new reel/strip component
- Test keyboard navigation in gallery

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
