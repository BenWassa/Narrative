# Narrative - Sprint Roadmap

## Overview
This document outlines the phased improvements to Narrative's photo organization workflow, focusing on UX/UI fixes, gallery view enhancements, and workflow improvements.

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

## Sprint 8.5: Finish Modularization of `PhotoOrganizer.tsx`
**Goal**: Reduce `PhotoOrganizer.tsx` to a thin layout container by extracting remaining modals, overlays, and orchestration logic.

### S8.5-1: Extract Modals and Overlays into Components
**Status**: completed  
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
**Status**: completed  
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
**Status**: completed  
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

## Sprint 9: Workflow Optimization & Deterministic Ordering (Substantial)
**Goal**: Systematically improve review speed and eliminate ordering edge cases across all views
**Status**: proposed

### S9-1: End-to-End Workflow Audit and Speed Pass
**Status**: proposed  
**Description**:
- Review the full organize → review → export loop
- Identify and implement high-leverage speedups (e.g., skip-assigned modes, bulk actions, tighter keyboard flows)
- Add lightweight instrumentation or benchmarks for large projects

### S9-2: Define and Centralize Photo Ordering Rules
**Status**: proposed  
**Description**:
- Establish a single, explicit ordering spec (timestamp + stable tie-breakers + view-specific grouping rules)
- Centralize ordering in a shared utility so grid, strip, and navigation always agree
- Add focused tests that lock in ordering behavior for ties and mixed media

### S9-3: Scale-Oriented UI Performance Improvements
**Status**: proposed  
**Description**:
- Evaluate virtualization for grids/strips and thumbnail loading strategies
- Improve perceived speed on 1k–10k item projects
- Add guardrails to avoid jank during rapid keyboard navigation

---

## Dependency Notes

Sprint 7 → (prerequisite) → Sprint 8.5
Sprint 8.5 → (prerequisite) → Sprint 9 (Workflow Optimization)

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
