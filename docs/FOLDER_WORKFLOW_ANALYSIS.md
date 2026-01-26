# Folder Workflow Analysis

**Date**: January 26, 2026  
**Status**: Review of current implementation and gaps

## Current Workflow Overview

### 1. **Onboarding Process**

The app currently follows this workflow when creating a new project:

1. **Folder Selection** (`OnboardingModal.tsx`)
   - User selects a root folder via File System Access API
   - App scans immediate child folders (1 level deep only)
   - Detects day mappings using `folderDetectionService.ts`

2. **Folder Detection** (`folderDetectionService.ts`)
   - Analyzes folder names for patterns:
     - `Day 1`, `D01`, `day_2` (high confidence)
     - ISO dates `2024-03-15` (high/medium confidence)
     - Numeric prefix `01`, `02` (medium confidence)
   - Skips system folders (`.DS_Store`, metadata)
   - Provides suggested mappings for review

3. **Photo Collection** (`projectService.ts`)
   - **Recursively** scans ALL subfolders
   - Collects all supported image files (jpg, jpeg, png, heic, webp, mp4, mov)
   - Flattens everything into a single photo list
   - Uses `filePath` to track original location (e.g., `Day 01/A_Establishing/IMG_1234.jpg`)

4. **Archive Detection**
   - Photos in folders containing "archive" are marked as archived
   - Based on `folderStructure.archiveFolder` setting (default: `98_ARCHIVE`)

### 2. **Photo Organization**

During the app session:
- Photos can be assigned to days (1-99)
- Photos can be assigned to buckets (A-E, M, X for archive)
- App generates sequential filenames based on assignments
- All edits stored in localStorage

### 3. **Export Process**

When exporting (`buildExportScript`):
- Generates a bash script that **copies** files
- Creates new folder structure:
  ```
  01_DAYS/
    Day 01/
      A_Establishing/
      B_People/
      C_Culture-Detail/
      ...
    Day 02/
      ...
  98_ARCHIVE/
  ```
- Uses `filePath` to reference original locations
- **Only touches files that have been assigned days/buckets**

---

## Current Limitations & Gaps

### ❌ **Gap 1: No Recognition of Existing Structure**

**Issue**: If a user already has organized folders like:
```
01_Days/
  Day 01/
    A_Establishing/
    B_People/
  Day 02/
    A_Establishing/
```

The app will:
- Scan all these subfolders recursively
- Flatten all photos into one list
- **Lose the subfolder structure** entirely
- Not recognize that buckets (A, B, etc.) already exist
- User would have to manually re-assign buckets

**What's Missing**:
- Detection of bucket subfolders (A_Establishing, B_People, etc.)
- Preservation of existing day/bucket assignments from folder structure
- Auto-mapping photos to days/buckets based on their current location

---

### ❌ **Gap 2: Cannot Add New Photos to Existing Structure**

**Scenario**: User has organized 500 photos into days/buckets. Now they want to add 50 new diving photos from Day 2 only.

**Current Behavior**:
- Would need to create a NEW project
- OR re-scan the entire folder (loses existing organization)
- Cannot selectively add/review new folders

**What's Missing**:
- Ability to add additional folders to an existing project
- Selective folder import
- Merge new photos with existing organization
- Detect which photos are new vs. already organized

---

### ❌ **Gap 3: Export Script Touches ALL Files**

**Issue**: Export script will try to copy:
- Files that are already in the correct location
- Files that haven't been edited
- Files that were part of the original structure

**What's Missing**:
- Smart detection of which files need to be moved
- Skip files that are already in target locations
- Only process "new" files or files with changed assignments

---

### ❌ **Gap 4: No Flexible Folder Viewing**

**Current UI**:
- Gallery view shows all photos
- Filter by day/bucket
- No visual representation of folder hierarchy

**What's Missing**:
- Folder tree/hierarchy view
- See photos grouped by their current folder location
- Navigate subfolders within the UI
- Visual indication of which photos are in organized vs. unorganized folders

---

### ❌ **Gap 5: Cannot Handle Mixed Input**

**Scenario**: User receives:
```
Iceland_Trip/
  Organized_Photos/
    01_Days/
      Day 01/
        A_Establishing/
  New_Batch/
    random_photos_123.jpg
    IMG_0001.jpg
  Diving_Day_2/
    GOPR0001.MP4
```

**Current Behavior**:
- Scans everything recursively
- Flattens all into one list
- Loses context about which folders are organized vs. messy

**What's Missing**:
- Mixed-mode handling (some folders organized, some not)
- Preserve organized folders while organizing messy ones
- Selective organization workflows

---

## Required Features for Flexible Workflow

### ✅ **Feature 1: Intelligent Structure Detection**

When scanning a folder, detect:

1. **Pre-organized structure** (high confidence):
   ```
   01_Days/Day 01/A_Establishing/
   ```
   - Has days folder container
   - Has day subfolders
   - Has bucket subfolders with A-E naming
   - **Action**: Preserve structure, auto-assign photos

2. **Partially organized** (medium confidence):
   ```
   Day 01/photos_here.jpg
   Day 02/photos_here.jpg
   ```
   - Has day folders but no buckets
   - **Action**: Preserve days, allow bucket assignment

3. **Unorganized** (needs work):
   ```
   random_folder/IMG_001.jpg
   ```
   - No recognizable structure
   - **Action**: Standard workflow (assign days/buckets)

### ✅ **Feature 2: Folder-Aware Photo Import**

Store additional metadata for each photo:
```typescript
interface ProjectPhoto {
  // ... existing fields
  sourceFolder?: string;        // Immediate parent folder
  folderPath?: string;          // Full folder hierarchy
  isPreOrganized?: boolean;     // Was this in an organized structure?
  detectedDay?: number | null;  // Day detected from folder structure
  detectedBucket?: string | null; // Bucket detected from folder structure
}
```

During import:
- Parse `folderPath` to detect structure
- Extract day number from folder names
- Extract bucket from subfolder names (A_Establishing → A)
- Mark as pre-organized if confidence is high

### ✅ **Feature 3: Folder Hierarchy View**

Add new viewing mode to PhotoOrganizer:
```typescript
type ViewMode = 'gallery' | 'inspect' | 'folders';
```

Folder view should:
- Display collapsible folder tree
- Show photo counts per folder
- Allow drilling down into subfolders
- Highlight organized vs. unorganized folders
- Quick assign entire folders to days/buckets

### ✅ **Feature 4: Smart Export**

Export script improvements:

1. **Track file state**:
   - `unchanged`: Already in correct location with correct name
   - `new`: Not in organized structure yet
   - `modified`: Assignment changed from original

2. **Only process changed files**:
   ```bash
   # Skip files already in correct location
   if [ -e "${target_path}/${new_name}" ]; then
     echo "✓ Already organized: ${new_name}"
     continue
   fi
   ```

3. **Preserve existing organized files**:
   - Don't move files that are already in `01_Days/Day XX/Y_Bucket/`
   - Only copy NEW files or files with CHANGED assignments

### ✅ **Feature 5: Incremental Project Updates**

Add capability to:
- Add new folders to existing project
- Detect new/modified photos since last scan
- Merge new photos with existing organization
- Preserve user edits during re-scan

API additions:
```typescript
async function addFolderToProject(
  projectId: string,
  folderHandle: FileSystemDirectoryHandle,
  options?: {
    mergeStrategy: 'preserve' | 'overwrite';
    detectExisting: boolean;
  }
): Promise<{ newPhotos: ProjectPhoto[], conflicts: PhotoConflict[] }>;
```

---

## Recommended Implementation Plan

### Phase 1: Structure Detection Enhancement
1. Update `folderDetectionService.ts` to detect bucket subfolders
2. Add bucket pattern matching (A_Establishing, B_People, etc.)
3. Enhance `FolderMapping` to include detected buckets
4. Store folder hierarchy metadata in photos

### Phase 2: Smart Photo Import
1. Modify `buildPhotosFromHandle` to preserve folder context
2. Add detection logic for pre-organized photos
3. Auto-assign day/bucket from folder structure
4. Flag pre-organized vs. new photos

### Phase 3: Export Intelligence
1. Add file state tracking (unchanged/new/modified)
2. Update `buildExportScript` to skip unchanged files
3. Add dry-run summary showing what will actually move
4. Preserve files already in organized structure

### Phase 4: Folder View UI
1. Create folder tree component
2. Add folder navigation
3. Bulk operations per folder
4. Visual indicators for organization status

### Phase 5: Incremental Updates
1. Add "Add Folder" capability
2. Merge logic for new photos
3. Conflict resolution UI
4. Smart re-scanning

---

## Key Design Principles

1. **Non-Destructive**: Never modify original files during organization
2. **Preserve Existing Work**: Recognize and maintain existing organization
3. **Flexible Input**: Handle any folder structure gracefully
4. **Smart Export**: Only touch files that need changes
5. **Transparent**: Show user what will happen before export
6. **Incremental**: Support adding photos without re-organizing everything

---

## Example Workflows

### Workflow A: Pre-Organized Folder
```
Input:
  01_Days/
    Day 01/
      A_Establishing/IMG_001.jpg
      B_People/IMG_002.jpg

App Behavior:
  ✓ Detects organized structure
  ✓ Auto-assigns photos: IMG_001 → Day 1, Bucket A
  ✓ User can review, add new photos, adjust as needed
  ✓ Export only touches NEW photos or CHANGED assignments
```

### Workflow B: Mixed Structure
```
Input:
  01_Days/Day 01/A_Establishing/IMG_001.jpg  (organized)
  New_Photos/IMG_999.jpg                      (unorganized)
  Diving_Day_2/GOPR001.MP4                    (partially organized)

App Behavior:
  ✓ IMG_001: Detected as Day 1, Bucket A (pre-organized)
  ✓ IMG_999: Needs day/bucket assignment
  ✓ GOPR001: Detected as Day 2, needs bucket assignment
  ✓ User assigns missing info
  ✓ Export only moves IMG_999 and GOPR001
```

### Workflow C: Add New Photos Later
```
Existing Project: 500 photos organized
New Input: Diving_Photos_Day_2/ (50 new photos)

App Behavior:
  ✓ Add folder to existing project
  ✓ Detect 50 new photos
  ✓ Preserve existing 500 photos' organization
  ✓ Auto-assign new photos to Day 2 (from folder name)
  ✓ User assigns buckets to new photos
  ✓ Export only touches the 50 new photos
```

---

## Next Steps

1. **Review this analysis** with stakeholders
2. **Prioritize features** based on user needs
3. **Design detailed specs** for each phase
4. **Update architecture docs** with new data models
5. **Create implementation tickets** for development

---

## Questions for Decision

1. Should we support **moving** files in addition to copying?
2. How should we handle **conflicts** (same file in multiple locations)?
3. Should organized files be **editable** or locked?
4. What's the **UI flow** for adding folders to existing projects?
5. How do we handle **permissions** for writing back to organized folders?
