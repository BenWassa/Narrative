# Narrative - Sprint Roadmap

## Overview
This document outlines the phased improvements to Narrative's photo organization workflow, focusing on UX/UI fixes, gallery view enhancements, and workflow improvements.

---

Completed sprints are archived in `archive/SPRINTS_COMPLETE.md`.

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
