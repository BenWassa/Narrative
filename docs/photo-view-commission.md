# Photo Viewing Modes Commission

## Objective

Provide two photo viewing modes—Gallery and Inspect—so users can quickly assign photos in a larger view while keeping all existing assignment and navigation workflows intact.

## User Outcomes

- Quickly switch between Gallery and Inspect without losing selection, focus, or filters.
- Assign photos while viewing them large and move through photos with arrow keys.
- Return to Gallery with the same context (filters, selection, focus).

## Scope

### In Scope

- Add a `viewMode` toggle with options: `Gallery` and `Inspect`.
- Inspect mode displays a large photo/video viewer with assignment controls active.
- Keyboard navigation in Inspect: Arrow keys move to next/previous within the current filtered list.
- Single click selects/focuses a photo in both modes.
- State persistence of view mode (and optionally focus) across reloads.
- Full-res loading from `fileHandle` with thumbnail fallback.

### Out of Scope

- Changes to project data schema or photo metadata fields.
- New editing tools beyond existing assign/favorite actions.
- External sharing, export, or multi-user collaboration.

## Functional Requirements

1. **Mode Toggle**

   - Provide a top-level toggle: `Gallery` | `Inspect`.
   - Switching modes does not modify photo data or filters.

2. **Selection and Focus Behavior**

   - Single click selects and focuses a photo.
   - Inspect mode shows the focused photo in large view.
   - Leaving Inspect preserves selection and focus.

3. **Keyboard Navigation**

   - Arrow Left/Right navigates within `filteredPhotos`.
   - Enter/Space opens Inspect for the focused photo (optional in Gallery).
   - Esc exits Inspect without losing selection.

4. **Assignments in Inspect**

   - Day assignment, bucket assignment, and favorite toggle work exactly as in Gallery.
   - Assignment actions update the same state (no duplicated logic).

5. **Media Loading**

   - Load full-res image/video via `photo.fileHandle.getFile()` when available.
   - Fallback to `photo.thumbnail` if full-res fails.
   - Revoke object URLs on change/unmount.

6. **State Persistence**
   - Persist `viewMode` locally (e.g., localStorage).
   - Optional: persist last `focusedPhoto` if it improves continuity.

## UX Notes

- Inspect layout: large viewer + right panel with existing controls.
- Optional filmstrip if more context is needed, but not required for MVP.
- Ensure that switching modes is fast and does not reprocess photos.

## Technical Approach (High Level)

- Add `viewMode` state in `PhotoOrganizer`.
- Reuse existing `selectedPhotos`, `focusedPhoto`, and `filteredPhotos`.
- Extract viewer to a `PhotoViewer` component for full-res loading and cleanup.
- Keep assignment controls shared between modes.

## Acceptance Criteria

- User can toggle between Gallery and Inspect without losing selection.
- In Inspect, arrow keys move to next/previous photo and update the large view.
- Assignments performed in Inspect are immediately reflected in Gallery.
- Reloading restores the last selected mode without errors.
- No regressions in existing keyboard shortcuts or selection behavior.

## Risks and Mitigations

- **Object URL leaks**: ensure URLs are revoked on cleanup.
- **State divergence**: keep a single source of truth for selection/focus.
- **Large file load delays**: provide thumbnail fallback and loading indicator.

## Open Questions

- Should Inspect include a filmstrip by default, or only large view + controls?
- Persist `focusedPhoto` across reloads or only `viewMode`?
