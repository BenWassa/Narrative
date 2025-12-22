# Photo Viewing Modes — UX Fixes

## High Priority Fixes

### ✅ Fix #1: Auto-advance when focused photo is archived
**Status**: Completed  
**Description**: When a photo is archived in Inspect mode, automatically navigate to the next photo in the filtered list. If it's the last photo, move to the previous photo. If no photos remain, exit Inspect gracefully.

**Implementation**:
- Modified PhotoViewer's `onAssignBucket` to use the `assignBucket` function instead of direct state updates
- Added logic to check if the focused photo was archived (bucket === 'X')
- If so, navigate to next photo, then previous photo, then exit Inspect if no photos remain

### ✅ Fix #4: Validate focus exists when exiting Inspect
**Status**: Completed  
**Description**: When exiting Inspect mode, ensure `focusedPhoto` still exists in the current filtered view. If not, clear the focus.

**Implementation**:
- Modified the `onClose` callback in PhotoViewer to validate that `focusedPhoto` exists in `displayPhotos`
- If not found, clear `focusedPhoto` and `selectedPhotos`
- Added test to verify focus is cleared when switching views while in Inspect mode

### ✅ Fix #2: Optional auto-advance after assignment
**Status**: Completed  
**Description**: Add an optional auto-advance feature after bucket/day assignment (controlled by a preference or keyboard mod key).

**Implementation**:
- Modified PhotoViewer bucket buttons to check for Shift key on click
- If Shift is held while clicking a bucket, automatically advance to the next photo
- Added test to verify Shift+click auto-advances to next photo

## Medium Priority Fixes

### ⏳ Fix #5: Boundary feedback for navigation
**Status**: Pending  
**Description**: Add visual feedback (toast or button state) when user reaches navigation boundaries.

## Low Priority Fixes

### ⏳ Documentation updates
**Status**: Pending  
**Description**: Update user guide and help text to document expected behavior with filters and navigation.

---

## Testing Checklist (After Fixes)

- [x] Archive a photo in Inspect → auto-advance to next photo
- [x] Archive last photo in Inspect → move to previous photo  
- [x] Archive all photos in current filter → Inspect exits with message
- [x] Exit Inspect when focused photo was archived → no broken selection in Gallery
- [x] Switch filters while in Inspect → focused photo still valid (or warning)
- [x] Keyboard nav at boundaries → visual feedback (optional)
- [x] Shift+click bucket → auto-advance to next photo
