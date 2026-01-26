# Photo Viewing Modes — UX Issues & Recommendations

## Issue #1: Archiving a photo exits Inspect mode ❌
**Severity**: High  
**Current Behavior**: User is in Inspect mode, assigns bucket 'X' (Archive) to focused photo → photo gets `archived: true` → photo disappears from `filteredPhotos` → PhotoViewer doesn't render because `focusedPhoto` is no longer in filtered list → defaults back to Gallery view.

**Root Cause**: When a photo is archived, it's immediately filtered out. If it's the focused photo in Inspect, there's no fallback logic to navigate to the next photo or to keep Inspect open.

**User Impact**: Disruptive workflow — user loses context after each archive action.

**Recommended Fix**:
1. When focused photo is archived in Inspect mode, automatically navigate to the next photo in the filtered list.
2. If it's the last photo, move to the previous photo.
3. If no photos remain in the filtered list after archive, exit Inspect with a gentle message.

---

## Issue #2: Day/Bucket assignment doesn't auto-advance ❌
**Severity**: Medium  
**Current Behavior**: User assigns a day or bucket to a photo in Inspect → photo state updates → user must manually press arrow key to move to next photo.

**Expected Behavior**: After assignment, optionally auto-advance to the next photo (toggle-able preference).

**Recommendation**: Add an optional auto-advance feature after bucket/day assignment (can be controlled by a preference or keyboard mod key).

---

## Issue #3: Favorite toggle in Inspect doesn't auto-advance ✅
**Severity**: Low (actually OK)  
**Current Behavior**: Pressing F toggles favorite and stays on the same photo.  
**This is fine** — user can mark favorites quickly without moving.

---

## Issue #4: Exiting Inspect loses context if photo is deleted/archived ❌
**Severity**: Medium  
**Scenario**: User in Inspect, archives photo, Inspect exits → Gallery is shown but `focusedPhoto` no longer exists → no photo is highlighted.

**Recommendation**: When exiting Inspect, validate that `focusedPhoto` exists in current filtered view. If not, clear focus.

---

## Issue #5: No visual feedback for "last photo" boundary ❌
**Severity**: Low  
**Current Behavior**: User presses → at the last photo, nothing happens. No indicator that boundary was reached.

**Recommendation**: Optionally show a toast or disable the button at boundaries.

---

## Issue #6: Navigation within filtered list not always intuitive ⚠️
**Severity**: Low  
**Scenario**: User is filtering by day, navigates in Inspect, then switches back to Gallery and changes the filter → Inspect photo may no longer exist.

**Recommendation**: This is expected behavior (filters change the list), but worth documenting in help.

---

## Issue #7: Selection not preserved when exiting Inspect ⚠️
**Severity**: Low  
**Current Behavior**: User selects photo in Gallery, double-clicks to enter Inspect, presses Esc → exits to Gallery but the photo is still selected.  
**This is fine** — selection is preserved as designed.

---

## Summary of Required Fixes

| Issue | Fix | Effort | Priority |
|-------|-----|--------|----------|
| #1: Archiving exits Inspect | Auto-advance to next photo when focused is archived | Small | High |
| #2: No auto-advance after assignment | Add optional auto-advance (feature flag or preference) | Medium | Medium |
| #3: Favorite toggle stays | ✅ Already good behavior | — | — |
| #4: Exiting loses context | Validate focus exists before exiting | Small | Medium |
| #5: No boundary feedback | Add visual/toast feedback at boundaries | Small | Low |
| #6: Filter + navigation edge case | Document in help; consider warning | Small | Low |
| #7: Selection preservation | ✅ Already working as intended | — | — |

---

## Recommended Implementation Order

1. **Fix #1 (Archive auto-advance)** — Required for acceptable UX.
2. **Fix #4 (Validate focus on exit)** — Prevents broken state.
3. **Fix #2 (Optional auto-advance)** — Nice-to-have for power users.
4. **Fix #5 (Boundary feedback)** — Polish.

---

## Example UX Flow After Fix #1

```
Gallery View → User double-clicks photo #3
    ↓
Inspect Mode (photo #3 focused)
    ↓
User presses 'X' (Archive bucket) → photo #3 archived
    ↓
Inspect Mode auto-advances to photo #4
    ↓
User continues assigning with arrows
    ↓
User presses Esc → back to Gallery (context preserved)
```

---

## Testing Checklist (After Fixes)

- [ ] Archive a photo in Inspect → auto-advance to next photo
- [ ] Archive last photo in Inspect → exit gracefully or move to previous
- [ ] Archive all photos in current filter → Inspect exits with message
- [ ] Exit Inspect when focused photo was archived → no broken selection in Gallery
- [ ] Switch filters while in Inspect → focused photo still valid (or warning)
- [ ] Keyboard nav at boundaries → visual feedback (optional)
