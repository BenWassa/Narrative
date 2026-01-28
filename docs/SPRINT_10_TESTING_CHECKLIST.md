# Sprint 10: Manual Testing Checklist

## S10-1: Ingest State & Path Resolution

### Test 1: Auto-Detection of Ingest State
- [ ] Open existing project with photos in `01_DAYS` folder structure
- [ ] Verify ingested state is auto-detected as `true`
- [ ] Open project with photos NOT in `01_DAYS` folder
- [ ] Verify ingested state is auto-detected as `false`

### Test 2: Source Root Resolution
- [ ] Create ingested project
- [ ] Verify source root equals project root path
- [ ] Create non-ingested project
- [ ] Verify source root is detected from common photo paths

### Test 3: Destination Root Resolution
- [ ] In ingested project, verify destination root = project root
- [ ] In non-ingested project, verify destination root = source folder
- [ ] Verify MECE bucket paths are correct for both modes

## S10-2: Export Script Generation

### Test 4: Ingested Project Export
- [ ] Create project with photos in `01_DAYS/Day 01/Original Photos/`
- [ ] Assign photos to different MECE buckets (A, B, C)
- [ ] Generate export script
- [ ] Verify script creates MECE folders inside day folder: `01_DAYS/Day 01/A_Establishing/`
- [ ] Verify source paths reference project root
- [ ] Verify preview section shows accurate counts

### Test 5: Non-Ingested Project Export
- [ ] Create project pointing to external photo folder
- [ ] Assign photos to MECE buckets
- [ ] Generate export script
- [ ] Verify script creates MECE folders in source location: `/source/photos/A_Establishing/`
- [ ] Verify no `01_DAYS` folder is created
- [ ] Verify preview matches expected behavior

### Test 6: Export Script Dry-Run
- [ ] Generate export script
- [ ] Verify it shows dry-run preview first
- [ ] Verify accurate file counts
- [ ] Verify confirmation prompt before execution
- [ ] Run script and verify files are copied correctly

### Test 7: Modified Photos Only
- [ ] Create project with some already-organized photos
- [ ] Modify a subset of photos (change bucket, rename)
- [ ] Generate export script
- [ ] Verify only modified photos are included
- [ ] Verify existing organized photos are skipped

## S10-3: Undo/Redo Functionality

### Test 8: Export Manifest Generation
- [ ] Perform an export operation
- [ ] Verify export manifest is saved to localStorage
- [ ] Check manifest contains all operations
- [ ] Verify manifest includes file sizes and paths

### Test 9: Undo Script Generation
- [ ] After export, click "Undo Export" button
- [ ] Verify undo script modal appears
- [ ] Verify script shows warning about deletion
- [ ] Download undo script
- [ ] Verify script contains size validation logic

### Test 10: Undo Script Execution
- [ ] Run generated undo script
- [ ] Verify dry-run preview shows files to be deleted
- [ ] Confirm deletion with "DELETE" input
- [ ] Verify files are deleted correctly
- [ ] Verify empty directories are removed
- [ ] Verify files with size mismatch are skipped with warning

### Test 11: Undo Idempotency
- [ ] Run undo script once
- [ ] Run undo script again
- [ ] Verify script handles already-deleted files gracefully
- [ ] Verify no errors occur on second run

### Test 12: Undo with Modified Files
- [ ] Export photos
- [ ] Manually edit one of the exported files (change size)
- [ ] Run undo script
- [ ] Verify modified file is skipped (size mismatch)
- [ ] Verify other files are deleted normally

## S10-4: UI Integration

### Test 13: Ingest State Indicator
- [ ] Open ingested project
- [ ] Verify UI shows appropriate ingest status (if implemented)
- [ ] Open non-ingested project
- [ ] Verify UI reflects non-ingested state

### Test 14: Undo Export Button
- [ ] Open project without any exports
- [ ] Verify "Undo Export" button is hidden
- [ ] Perform an export
- [ ] Verify "Undo Export" button appears in header
- [ ] Click button and verify undo modal opens

### Test 15: Export Modal - Destination Preview
- [ ] Open export modal
- [ ] Verify detected project path is shown
- [ ] Verify path can be edited
- [ ] Change path and verify script regenerates
- [ ] Verify destination preview matches ingest mode

### Test 16: Undo Modal UI
- [ ] Open undo modal
- [ ] Verify warning message is displayed
- [ ] Verify script preview is shown
- [ ] Verify download button works
- [ ] Verify cancel button closes modal

## S10-5: Edge Cases & Safety

### Test 17: Missing Source Files
- [ ] Create export manifest
- [ ] Delete some source files
- [ ] Run undo script
- [ ] Verify script handles missing files gracefully
- [ ] Verify no errors abort the operation

### Test 18: Large Project Performance
- [ ] Create project with 1000+ photos
- [ ] Assign to multiple days and buckets
- [ ] Generate export script
- [ ] Verify script generation is fast (<2 seconds)
- [ ] Verify preview is accurate
- [ ] Verify manifest generation completes

### Test 19: Special Characters in Paths
- [ ] Create project with spaces in folder names
- [ ] Create project with special chars (apostrophes, quotes)
- [ ] Generate export script
- [ ] Verify paths are properly escaped in script
- [ ] Run script and verify it handles paths correctly

### Test 20: Backward Compatibility
- [ ] Open project created before Sprint 10
- [ ] Verify it loads without errors
- [ ] Verify `ingested` defaults to `true`
- [ ] Verify export still works
- [ ] Verify no data loss occurs

## Integration Testing

### Test 21: End-to-End Workflow - Ingested
1. [ ] Create new project
2. [ ] Import photos (ingest into project)
3. [ ] Assign photos to days and MECE buckets
4. [ ] Mark some photos as favorites
5. [ ] Archive some photos
6. [ ] Generate export script
7. [ ] Download and run export script
8. [ ] Verify organized folder structure is created
9. [ ] Click "Undo Export"
10. [ ] Download and run undo script
11. [ ] Verify exported files are removed
12. [ ] Verify project state is intact

### Test 22: End-to-End Workflow - Non-Ingested
1. [ ] Create project pointing to external photos
2. [ ] Assign photos to MECE buckets (no days)
3. [ ] Generate export script
4. [ ] Verify MECE folders are created in source location
5. [ ] Run export script
6. [ ] Verify photos are copied to MECE buckets
7. [ ] Run undo script
8. [ ] Verify MECE folders and files are removed

## Acceptance Criteria Verification

- [ ] Ingested exports copy into day MECE folders, creating buckets as needed ✓
- [ ] Non-ingested exports create MECE buckets inside the source folder ✓
- [ ] Undo reliably reverts the last export without data loss ✓
- [ ] Export preview matches actual operations ✓
- [ ] File size validation prevents accidental deletion of modified files ✓
- [ ] Empty directories are cleaned up after undo ✓
- [ ] UI clearly shows when undo is available ✓
- [ ] All operations are safe and reversible ✓

---

## Test Results Summary

Date: _____________

Tester: _____________

Total Tests: 22
Passed: ____
Failed: ____
Skipped: ____

### Issues Found:
1. 
2. 
3. 

### Notes:
