# Narrative - Sprint Roadmap

## Overview
This document outlines the phased improvements to Narrative's photo organization workflow, focusing on UX/UI fixes, gallery view enhancements, and workflow improvements.

---

Completed sprints are archived in `archive/SPRINTS_COMPLETE.md`.

## Sprint 10: Ingest-Aware Export + Undo (Substantial)
**Goal**: Make export behavior honor "ingest" state, support MECE folder creation in-source or in-day, and provide robust undo.

### S10-1: Define Ingest State + Source/Destination Rules
**Status**: not-started  
**Description**:
- Formalize what "ingest" means in data model/state.
- Define source root resolution (e.g., `01_DAYS/Day 02/Diving photos`) and destination rules:
  - Ingested: copy from source folder into existing day MECE buckets (create if missing).
  - Not ingested: copy into MECE buckets created inside the source folder.

**Implementation Notes**:
- Add explicit `ingested` flag + `sourceFolder` metadata on project/day.
- Establish single resolver for `source_root` and `destination_root`.
- Document rules in `docs/SPRINT_10_IMPLEMENTATION.md`.

### S10-2: Export Script Generator Updates
**Status**: not-started  
**Description**:
- Update export script generation to:
  - Use computed source/destination roots.
  - Create MECE folders in the correct location based on ingest state.
  - Support dry-run mode with accurate counts (derived from filesystem scan).

**Implementation Notes**:
- Ensure no hard-coded target paths.
- Emit a preview section from real data.
- Introduce `--dry-run` and `--execute` flags as optional CLI arguments.

### S10-3: Robust Undo/Redo for Export
**Status**: not-started  
**Description**:
- Generate a manifest (JSON) of all copy operations.
- Provide an undo script or built-in `--undo` mode that reverts copies safely.
- Ensure idempotency (skip if already reverted).

**Implementation Notes**:
- Store manifest alongside export script or in project metadata.
- Include checksums or file sizes to avoid deleting mismatched files.

### S10-4: UI Integration for Ingest + Export
**Status**: not-started  
**Description**:
- Make "Ingest" state explicit in UI with a clear toggle/indicator.
- Show destination preview based on ingest mode.
- Add an "Undo last export" action.

**Implementation Notes**:
- Hook into export modal and project header state.
- Keep user-facing language consistent with ingest behavior.

### S10-5: Tests + Safety Validation
**Status**: not-started  
**Description**:
- Add unit tests for path resolution logic.
- Add integration test coverage for export script generation.
- Manual test checklist for:
  - Ingested vs not ingested behavior
  - Undo correctness
  - Missing source files

**Acceptance Criteria**:
- Ingested exports copy into day MECE folders, creating buckets as needed.
- Non-ingested exports create MECE buckets inside the source folder.
- Undo reliably reverts the last export without data loss.
- Export preview matches actual operations.

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
