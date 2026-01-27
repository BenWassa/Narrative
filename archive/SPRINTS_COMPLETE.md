# Narrative - Completed Sprints

## Sprint 8.5: Finish Modularization of `PhotoOrganizer.tsx`
**Status**: completed (2026-01-27)  
**Goal**: Reduce `PhotoOrganizer.tsx` to a thin layout container by extracting remaining modals, overlays, and orchestration logic.

### S8.5-1: Extract Modals and Overlays into Components
**Status**: completed  
**Completed Work**:
- Extracted UI blocks into dedicated components in `src/features/photo-organizer/components`: `HelpModal.tsx`, `ExportScriptModal.tsx`, `FullscreenOverlay.tsx`, `Toast.tsx`.

### S8.5-2: Extract Remaining Orchestration into Hooks
**Status**: completed  
**Completed Work**:
- Extracted orchestration logic into hooks in `src/features/photo-organizer/hooks`: `useToast.ts`, `useExportScript.ts`, `useKeyboardShortcuts.ts`, `useDayEditing.ts`.

### S8.5-3: Refactor `PhotoOrganizer.tsx` to Wiring Only
**Status**: completed  
**Completed Work**:
- `PhotoOrganizer.tsx` now composes hooks and components rather than embedding modal/overlay logic inline.

---

## Sprint 9: Workflow Optimization & Deterministic Ordering (Substantial)
**Goal**: Systematically improve review speed and eliminate ordering edge cases across all views
**Status**: completed

---

### WORKFLOW ANALYSIS

#### Current Workflow Flow
1. **Project Creation/Loading** (`OnboardingModal` → `projectService.buildPhotosFromHandle`)
   - User selects folder → scans files → detects day structure → loads thumbnails
   - Creates `ProjectPhoto[]` with metadata (timestamp, path, detected day/bucket)
   
2. **Photo Organization** (`PhotoOrganizer` → `LeftSidebar` + `PhotoGrid`)
   - **View Options**: Days, Folders, Root, Favorites, Archive, Review
   - **Selection Model**: Click/Cmd+Click/Shift+Click in grid → updates `selectedPhotos` Set
   - **Filtering**: `useFolderModel.filteredPhotos` filters by view + `hideAssigned` flag
   - **Assignment**: Keyboard shortcuts (A-E, M, X) call `usePhotoMutations.assignBucket(photoIds[], bucket)`
   
3. **Gallery/Viewer Navigation** (`PhotoViewer` + `PhotoStrip`)
   - Double-click opens `PhotoViewer` with full-res photo
   - Navigation uses `filteredPhotos` array for prev/next
   - **Auto-advance**: After bucket assignment, advances to next photo
   
4. **Export** (`useExportScript`)
   - Generates bash script grouping photos by day/bucket
   - Creates folder structure: `01_DAYS/Day 01 - Label/A_Establishing/`

#### Key Pain Points Identified

**Ordering Inconsistencies**:
- `stableSortPhotos()` in `PhotoGrid.tsx` (timestamp → filePath → originalName → id)
- **NOT centralized** - sorting logic duplicated in multiple places
- Gallery viewer uses `filteredPhotos.findIndex()` which depends on filtering order
- Subfolder grouping can disrupt chronological flow within a day
- Video/photo split within subfolders changes ordering

**Workflow Friction**:
- No "skip assigned" mode - must manually filter with hideAssigned toggle
- No bulk actions beyond keyboard shortcuts on selection
- Keyboard nav in grid requires finding photo index in `filteredPhotos` each time
- No fast "review unassigned only" workflow
- Gallery auto-advance only works when assigning buckets, not when skipping

**Performance Bottlenecks**:
- Grid renders ALL filtered photos (no virtualization)
- Thumbnail loading is synchronous during initial scan
- `filteredPhotos` recalculated on every render via useMemo
- PhotoStrip in viewer loads all thumbnails

---

### S9-1: End-to-End Workflow Audit and Speed Pass
**Status**: completed  
**Priority**: HIGH
**Description**:
Optimize the review workflow for speed and efficiency, focusing on high-leverage improvements.

**Tasks**:
1. **Add "Skip Assigned" Quick Mode**
   - Add keyboard shortcut (e.g., `Shift+H`) to toggle `hideAssigned` from anywhere
   - Show persistent indicator when skip mode is active
   - Make this the default mode in gallery viewer

2. **Implement Smart Auto-Advance in Gallery**
   - Current: Auto-advance only after bucket assignment
   - New: Add keyboard shortcut (e.g., `Space` or `N`) to skip to next unassigned photo
   - Respect `hideAssigned` filter when advancing
   - Add visual indicator showing "X of Y unassigned remaining"

3. **Add Bulk Assignment Shortcuts**
   - In grid view: Select multiple → press bucket key → assigns all selected
   - Add "Assign + Advance" keyboard combo (e.g., `Ctrl+A` assigns 'A' and moves to next)
   - Add "Archive Selected" bulk action (X key on multi-select)

4. **Optimize Keyboard Navigation Flow**
   - Add `J`/`K` keys for next/previous in grid (vim-style)
   - Add `Shift+J`/`Shift+K` for next/previous unassigned
   - Improve focus visibility in grid when using keyboard
   - Add breadcrumb indicator showing current position in filtered list

5. **Add Performance Instrumentation**
   - Track time-to-first-photo after project load
   - Measure avg photos organized per minute
   - Log performance metrics for large projects (>1000 photos) to console
   - Add debug overlay showing filter/sort/render times

**Implementation Files**:
- `hooks/useKeyboardShortcuts.ts` - Add new shortcuts
- `hooks/useViewOptions.ts` - Add skip mode state/toggle
- `components/PhotoGrid.tsx` - Bulk actions, keyboard nav
- `ui/PhotoViewer.tsx` - Smart auto-advance logic
- `components/ProjectHeader.tsx` - Status indicators

**Acceptance Criteria**:
- Can review 100 photos with <50 keystrokes (assign + advance)
- Skip assigned mode works in all views
- Performance metrics show <2s load time for 1000 photos
- All new shortcuts documented in HelpModal

---

### S9-2: Define and Centralize Photo Ordering Rules
**Status**: completed  
**Priority**: CRITICAL
**Description**:
Establish single source of truth for photo ordering to eliminate inconsistencies across views.

**Current State**:
- `PhotoGrid.tsx` has `stableSortPhotos()`
- `projectService.ts` has simple timestamp sort
- Each view independently handles grouping/sorting
- No guaranteed ordering for photos with identical timestamps

**Proposed Ordering Spec**:
```typescript
// Primary sort: timestamp (chronological)
// Tie-breaker 1: filePath (folder structure)
// Tie-breaker 2: originalName (alphabetical)
// Tie-breaker 3: id (stable unique identifier)
// View-specific: grouping by subfolder, bucket, or day (preserves above order within groups)
```

**Tasks**:
1. **Create Central Ordering Utility**
   - New file: `utils/photoOrdering.ts`
   - Export `sortPhotos(photos: ProjectPhoto[], options?: SortOptions): ProjectPhoto[]`
   - Support options: `groupBy: 'subfolder' | 'bucket' | 'day' | null`, `separateVideos: boolean`
   - Return stable-sorted array + index map for O(1) lookups

2. **Refactor All Ordering Call Sites**
   - Replace `stableSortPhotos` in `PhotoGrid.tsx`
   - Update `useFolderModel.filteredPhotos` to use central utility
   - Ensure `PhotoViewer` navigation uses same ordering
   - Update `PhotoStrip` to respect ordering

3. **Add Ordering Tests**
   - Test tie-breaking behavior (same timestamp)
   - Test video/photo splitting preserves chronological order
   - Test subfolder grouping maintains timestamp order within groups
   - Test that grid, viewer, and strip use identical ordering

4. **Document Ordering Rules**
   - Add section to `docs/ARCHITECTURE.md` explaining ordering logic
   - Add JSDoc comments to ordering utility
   - Update help modal to explain ordering behavior

**Implementation Files**:
- `utils/photoOrdering.ts` (NEW) - Central ordering logic
- `hooks/useFolderModel.ts` - Use new utility for filteredPhotos
- `components/PhotoGrid.tsx` - Replace stableSortPhotos
- `ui/PhotoViewer.tsx` - Ensure nav uses central ordering
- `__tests__/photoOrdering.test.ts` (NEW) - Comprehensive tests

**Acceptance Criteria**:
- All views show identical ordering for same photo set
- Navigation in viewer never skips photos
- Ordering deterministic and stable across page refreshes
- Tests cover all tie-breaking scenarios
- Zero ordering regressions in existing functionality

---

### S9-3: Scale-Oriented UI Performance Improvements
**Status**: completed  
**Priority**: MEDIUM
**Description**:
Improve performance for large projects (1k-10k photos) through virtualization and lazy loading.

**Current Performance Issues**:
- PhotoGrid renders all photos (e.g., 5000 DOM nodes for 1000 photos)
- Thumbnail generation blocks UI during initial load
- No progressive loading/rendering
- Re-renders entire grid on any state change

**Tasks**:
1. **Implement Virtual Scrolling for PhotoGrid**
   - Use `react-window` or `react-virtualized` for grid
   - Render only visible photos + buffer
   - Maintain scroll position during updates
   - Ensure selection/keyboard nav works with virtualization

2. **Optimize Thumbnail Loading Strategy**
   - Make thumbnail generation non-blocking (already uses workers)
   - Add progressive loading: load thumbnails in viewport first
   - Implement thumbnail caching in IndexedDB
   - Show placeholder/skeleton while loading

3. **Memoize Expensive Computations**
   - Audit all `useMemo` dependencies in hooks
   - Ensure `filteredPhotos` only recalculates when necessary
   - Cache ordering index maps
   - Prevent unnecessary re-sorts

4. **Add Performance Guardrails**
   - Debounce rapid keyboard navigation (prevent jank)
   - Throttle scroll events
   - Batch state updates where possible
   - Add loading states for expensive operations

5. **Measure and Monitor**
   - Add React DevTools profiler checkpoints
   - Track render count per component
   - Measure time to interactive
   - Log warnings for large photo sets (>5000)

**Implementation Files**:
- `components/PhotoGrid.tsx` - Virtual scrolling
- `workers/imageResizer.worker.ts` - Progressive loading
- `hooks/useFolderModel.ts` - Memoization improvements
- `hooks/useKeyboardShortcuts.ts` - Debouncing

**Acceptance Criteria**:
- Smooth 60fps scrolling with 5000+ photos
- Initial load <3s for 1000 photos
- No jank during rapid keyboard navigation
- Memory usage stays reasonable (no leaks)
- Virtual scrolling maintains selection state

---

### S9-4: Enhanced Filtering and View Options (BONUS)
**Status**: proposed  
**Priority**: LOW
**Description**:
Add advanced filtering options for power users.

**Potential Features**:
- Filter by bucket (show only bucket A photos)
- Filter by date range
- Filter by file type (photos only, videos only)
- Combined filters (day + bucket + unassigned)
- Save filter presets

**Implementation**: TBD after S9-1, S9-2, S9-3 complete

---

## Sprint 9: Recommended Execution Order

### Phase 1: Foundation (S9-2 - Ordering)
**Why First**: All other work depends on consistent ordering. Fix this before adding features.

1. Create `utils/photoOrdering.ts` with comprehensive ordering logic
2. Write tests for ordering edge cases
3. Refactor existing components to use centralized ordering
4. Verify no regressions in existing workflows

**Estimated Effort**: 4-6 hours  
**Files**: 3 new, 5 modified  
**Risk**: Medium (touching core rendering logic)

### Phase 2: Workflow Speed (S9-1 - Quick Wins)
**Why Second**: Build on stable ordering to add productivity features.

**Quick Wins (2-3 hours)**:
1. Add skip assigned toggle keyboard shortcut
2. Add bulk assignment for multi-select
3. Add J/K navigation in grid

**Medium Complexity (3-4 hours)**:
1. Implement smart auto-advance in viewer
2. Add "skip to next unassigned" navigation
3. Add visual indicators for workflow state

**Instrumentation (1-2 hours)**:
1. Add performance logging
2. Create debug overlay

**Estimated Effort**: 6-9 hours  
**Files**: 6 modified  
**Risk**: Low (mostly additive features)

### Phase 3: Performance (S9-3 - Optimization)
**Why Last**: Optimize after features are stable. Measure before/after.

**Assessment (1 hour)**:
1. Profile current performance with 1000+ photo project
2. Identify actual bottlenecks (don't guess)

**Virtual Scrolling (4-6 hours)**:
1. Integrate react-window/virtualized
2. Test with large datasets
3. Handle edge cases (selection, keyboard nav)

**Loading Optimization (2-3 hours)**:
1. Progressive thumbnail loading
2. IndexedDB caching
3. Lazy rendering

**Estimated Effort**: 7-10 hours  
**Files**: 4 modified, 1 new  
**Risk**: Medium-High (virtual scrolling can be tricky)

### Total Estimated Effort: 17-25 hours

---

## Implementation Checklist

### Before Starting
- [ ] Review current workflow end-to-end with test project
- [ ] Create branch: `feature/sprint-9-workflow-optimization`
- [ ] Set up test project with 500+ photos
- [ ] Document current performance baseline

### During Development
- [ ] Run tests after each sub-task
- [ ] Test with real project data (not just test fixtures)
- [ ] Document any breaking changes
- [ ] Update HelpModal for new keyboard shortcuts
- [ ] Keep PhotoOrganizer.tsx under 700 lines

### Before Merging
- [ ] All tests pass (unit + integration)
- [ ] Manual testing on 1000+ photo project
- [ ] No console errors or warnings
- [ ] Performance improved (measurable)
- [ ] Documentation updated (README, ARCHITECTURE)
- [ ] Keyboard shortcuts documented
- [ ] No regressions in existing features

---

## Dependency Notes

Sprint 7 → (prerequisite) → Sprint 9 (Workflow Optimization)

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
