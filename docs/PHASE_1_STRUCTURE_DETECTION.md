# Phase 1: Structure Detection Enhancement

**Date**: January 26, 2026  
**Status**: Implementation Plan  
**Parent Document**: [FOLDER_WORKFLOW_ANALYSIS.md](./FOLDER_WORKFLOW_ANALYSIS.md)

---

## Objective

Enable the app to detect and preserve pre-organized folder structures, automatically assigning days and buckets to photos based on their current folder location.

---

## Scope

### In Scope

- ✅ Detect bucket subfolders (A-M pattern matching)
- ✅ Detect day-bucket hierarchy (01_Days/Day XX/Y_Bucket/)
- ✅ Auto-assign photos to days/buckets from folder structure
- ✅ Store folder hierarchy metadata in photos
- ✅ Enhance FolderMapping interface with bucket detection
- ✅ Add confidence levels for bucket detection

### Out of Scope

- ❌ UI for folder tree view (Phase 4)
- ❌ Adding new folders to existing projects (Phase 5)
- ❌ Smart export logic (Phase 3)
- ❌ Manual conflict resolution UI

---

## Data Model Changes

### 1. Enhanced `ProjectPhoto` Interface

**File**: `src/frontend/services/projectService.ts`

```typescript
export interface ProjectPhoto {
  id: string;
  originalName: string;
  currentName: string;
  timestamp: number;
  day: number | null;
  bucket: string | null;
  sequence: number | null;
  favorite: boolean;
  rating: number;
  archived: boolean;
  thumbnail: string;
  mimeType?: string;
  fileHandle?: FileSystemFileHandle;
  filePath?: string;
  metadata?: {
    camera?: string;
    width?: number;
    height?: number;
  };

  // NEW: Structure detection metadata
  sourceFolder?: string; // Immediate parent folder name
  folderHierarchy?: string[]; // Full path as array: ['01_Days', 'Day 01', 'A_Establishing']
  detectedDay?: number | null; // Day number detected from folder structure
  detectedBucket?: string | null; // Bucket letter detected from folder structure
  isPreOrganized?: boolean; // True if found in organized structure
  organizationConfidence?: 'high' | 'medium' | 'low' | 'none'; // Detection confidence
}
```

**Manual Check**: Verify that adding these optional fields doesn't break existing code that creates `ProjectPhoto` objects.

---

### 2. Enhanced `FolderMapping` Interface

**File**: `src/services/folderDetectionService.ts`

```typescript
export interface FolderMapping {
  folder: string;
  folderPath: string;
  detectedDay: number | null;
  confidence: 'high' | 'medium' | 'low' | 'undetected';
  patternMatched: string;
  suggestedName: string;
  manual: boolean;
  photoCount: number;
  dateRange?: {
    start: string;
    end: string;
  };

  // NEW: Bucket detection
  detectedBuckets?: BucketInfo[]; // Subfolders detected as buckets
  isOrganizedStructure?: boolean; // True if this is a day folder with bucket subfolders
  bucketConfidence?: 'high' | 'medium' | 'low' | 'none';
}

// NEW: Bucket detection metadata
export interface BucketInfo {
  bucketLetter: string; // 'A', 'B', 'C', 'D', 'E', 'M'
  folderName: string; // 'A_Establishing', 'B_People', etc.
  photoCount: number;
  confidence: 'high' | 'medium' | 'low';
  patternMatched: string; // 'standard', 'custom', 'numeric'
}
```

**Manual Check**: Ensure backward compatibility with existing `OnboardingModal.tsx` code that uses `FolderMapping`.

---

## New Service Functions

### 3. Bucket Detection Service

**File**: `src/services/folderDetectionService.ts` (additions)

```typescript
/**
 * Bucket pattern matchers (in priority order)
 */

// Pattern 1: Standard bucket naming (highest confidence)
// Matches: "A_Establishing", "B_People", "C_Culture-Detail", etc.
const BUCKET_STANDARD_PATTERN =
  /^([A-M])_(Establishing|People|Culture|Detail|Action|Moment|Transition|Mood|Food)/i;

// Pattern 2: Simple bucket letter (high confidence)
// Matches: "A", "B", "C", etc.
const BUCKET_LETTER_PATTERN = /^([A-M])$/i;

// Pattern 3: Bucket with custom suffix (medium confidence)
// Matches: "A_Custom", "B_Whatever", etc.
const BUCKET_CUSTOM_PATTERN = /^([A-M])_(.+)$/i;

// Pattern 4: Numeric bucket folders (low confidence)
// Matches: "01", "02", "03", etc. (could be days or buckets)
const BUCKET_NUMERIC_PATTERN = /^(0[1-6])$/;

/**
 * Map numeric bucket folders to letters (if confident it's a bucket)
 */
const NUMERIC_TO_BUCKET_MAP: Record<string, string> = {
  '01': 'A',
  '02': 'B',
  '03': 'C',
  '04': 'D',
  '05': 'E',
  '06': 'M',
};

/**
 * Detect if a folder name matches bucket patterns
 */
export function detectBucketFromFolderName(
  folderName: string,
): { bucket: string; confidence: 'high' | 'medium' | 'low'; pattern: string } | null {
  // Pattern 1: Standard naming (A_Establishing, B_People, etc.)
  const standardMatch = folderName.match(BUCKET_STANDARD_PATTERN);
  if (standardMatch) {
    return {
      bucket: standardMatch[1].toUpperCase(),
      confidence: 'high',
      pattern: 'standard',
    };
  }

  // Pattern 2: Single letter (A, B, C, etc.)
  const letterMatch = folderName.match(BUCKET_LETTER_PATTERN);
  if (letterMatch) {
    return {
      bucket: letterMatch[1].toUpperCase(),
      confidence: 'high',
      pattern: 'letter',
    };
  }

  // Pattern 3: Custom suffix (A_Custom, B_Whatever, etc.)
  const customMatch = folderName.match(BUCKET_CUSTOM_PATTERN);
  if (customMatch) {
    return {
      bucket: customMatch[1].toUpperCase(),
      confidence: 'medium',
      pattern: 'custom',
    };
  }

  // Pattern 4: Numeric (01, 02, etc.) - lowest confidence
  const numericMatch = folderName.match(BUCKET_NUMERIC_PATTERN);
  if (numericMatch && NUMERIC_TO_BUCKET_MAP[numericMatch[1]]) {
    return {
      bucket: NUMERIC_TO_BUCKET_MAP[numericMatch[1]],
      confidence: 'low',
      pattern: 'numeric',
    };
  }

  return null;
}

/**
 * Analyze a folder path to detect organized structure
 * Returns detected day and bucket if found in path hierarchy
 */
export function analyzePathStructure(
  filePath: string,
  options?: {
    daysFolder?: string; // Expected days container (default: '01_DAYS')
  },
): {
  detectedDay: number | null;
  detectedBucket: string | null;
  isPreOrganized: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  pathSegments: string[];
} {
  const daysFolder = options?.daysFolder || '01_DAYS';
  const pathSegments = filePath.split(/[\\/]/).filter(Boolean);

  let detectedDay: number | null = null;
  let detectedBucket: string | null = null;
  let dayConfidence: 'high' | 'medium' | 'low' | 'none' = 'none';
  let bucketConfidence: 'high' | 'medium' | 'low' | 'none' = 'none';

  // Look for days container folder
  const daysIndex = pathSegments.findIndex(
    seg =>
      seg.toLowerCase() === daysFolder.toLowerCase() ||
      seg.toLowerCase() === '01_days' ||
      seg.toLowerCase() === 'days',
  );

  if (daysIndex !== -1 && daysIndex < pathSegments.length - 1) {
    // Next folder after days container should be a day folder
    const dayFolder = pathSegments[daysIndex + 1];
    const dayDetection = extractDayFromFolderName(dayFolder);

    if (dayDetection) {
      detectedDay = dayDetection.day;
      dayConfidence = dayDetection.confidence;

      // If there's another folder after the day folder, check if it's a bucket
      if (daysIndex + 2 < pathSegments.length) {
        const bucketFolder = pathSegments[daysIndex + 2];
        const bucketDetection = detectBucketFromFolderName(bucketFolder);

        if (bucketDetection) {
          detectedBucket = bucketDetection.bucket;
          bucketConfidence = bucketDetection.confidence;
        }
      }
    }
  } else {
    // No days container found - look for day folders directly
    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      const dayDetection = extractDayFromFolderName(segment);

      if (dayDetection) {
        detectedDay = dayDetection.day;
        dayConfidence = dayDetection.confidence === 'high' ? 'medium' : 'low';

        // Check next folder for bucket
        if (i + 1 < pathSegments.length) {
          const bucketFolder = pathSegments[i + 1];
          const bucketDetection = detectBucketFromFolderName(bucketFolder);

          if (bucketDetection) {
            detectedBucket = bucketDetection.bucket;
            bucketConfidence = bucketDetection.confidence;
          }
        }
        break;
      }
    }
  }

  // Determine overall confidence and pre-organized status
  const isPreOrganized = detectedDay !== null && detectedBucket !== null;
  let overallConfidence: 'high' | 'medium' | 'low' | 'none' = 'none';

  if (isPreOrganized) {
    // Both day and bucket detected
    if (dayConfidence === 'high' && bucketConfidence === 'high') {
      overallConfidence = 'high';
    } else if (dayConfidence !== 'none' && bucketConfidence !== 'none') {
      overallConfidence = 'medium';
    } else {
      overallConfidence = 'low';
    }
  } else if (detectedDay !== null) {
    // Only day detected
    overallConfidence = dayConfidence;
  }

  return {
    detectedDay,
    detectedBucket,
    isPreOrganized,
    confidence: overallConfidence,
    pathSegments,
  };
}

/**
 * Scan a day folder for bucket subfolders
 */
export async function detectBucketsInFolder(
  dirHandle: FileSystemDirectoryHandle,
): Promise<BucketInfo[]> {
  const buckets: BucketInfo[] = [];

  try {
    // @ts-ignore - entries() is supported in modern browsers
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind !== 'directory') continue;

      const bucketDetection = detectBucketFromFolderName(name);
      if (bucketDetection) {
        // Count photos in this bucket folder
        let photoCount = 0;
        // @ts-ignore
        for await (const [fileName, fileHandle] of handle.entries()) {
          if (fileHandle.kind !== 'file') continue;
          const ext = fileName.split('.').pop()?.toLowerCase() || '';
          if (['jpg', 'jpeg', 'png', 'heic', 'webp', 'mp4', 'mov'].includes(ext)) {
            photoCount++;
          }
        }

        buckets.push({
          bucketLetter: bucketDetection.bucket,
          folderName: name,
          photoCount,
          confidence: bucketDetection.confidence,
          patternMatched: bucketDetection.pattern,
        });
      }
    }
  } catch (error) {
    console.warn('Failed to scan for buckets:', error);
  }

  return buckets.sort((a, b) => a.bucketLetter.localeCompare(b.bucketLetter));
}
```

**Manual Check**:

1. Test bucket detection with various folder naming conventions
2. Verify pattern matching works correctly for all cases
3. Check that path parsing handles different separators (\ and /)

---

### 4. Enhanced Photo Import

**File**: `src/frontend/services/projectService.ts`

Modify `buildPhotosFromHandle` to include structure detection:

```typescript
export async function buildPhotosFromHandle(
  dirHandle: FileSystemDirectoryHandle,
  onProgress?: (progress: number, message: string) => void,
): Promise<ProjectPhoto[]> {
  const files = await collectFiles(dirHandle);
  const photos: ProjectPhoto[] = [];
  const seenFiles = new Set<string>();

  for (let i = 0; i < files.length; i++) {
    const entry = files[i];
    const progress = Math.round(((i + 1) / files.length) * 100);
    onProgress?.(progress, `Processing ${entry.handle.name}...`);

    const file = await entry.handle.getFile();
    const timestamp = file.lastModified;
    const originalName = file.name;

    const fileFingerprint = `${originalName}|${timestamp}|${file.size}`;
    if (seenFiles.has(fileFingerprint)) {
      if (DEBUG_LOGS) {
        console.debug(
          `[ProjectService] Skipping duplicate file: ${entry.path} (matches ${originalName})`,
        );
      }
      continue;
    }
    seenFiles.add(fileFingerprint);

    const id = generateId();
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isHeic = ext === 'heic' || ext === 'heif' || file.type.toLowerCase().includes('heic');

    let thumbnail = '';
    if (isHeic) {
      try {
        const blob = await heicToBlob(file);
        if (blob) {
          thumbnail = URL.createObjectURL(blob);
        }
      } catch (e) {
        console.warn(`Failed to generate preview for ${originalName}:`, e);
      }
    } else {
      try {
        thumbnail = URL.createObjectURL(file);
      } catch (e) {
        console.warn(`Failed to create object URL for ${originalName}:`, e);
      }
    }

    // NEW: Analyze folder structure
    const pathAnalysis = analyzePathStructure(entry.path);
    const pathSegments = entry.path.split(/[\\/]/).filter(Boolean);
    const sourceFolder = pathSegments[pathSegments.length - 2] || 'root';

    // NEW: Auto-assign day/bucket if detected with high confidence
    let day: number | null = null;
    let bucket: string | null = null;

    if (pathAnalysis.isPreOrganized && pathAnalysis.confidence === 'high') {
      day = pathAnalysis.detectedDay;
      bucket = pathAnalysis.detectedBucket;
    }

    photos.push({
      id,
      originalName,
      currentName: originalName,
      timestamp,
      day,
      bucket,
      sequence: null,
      favorite: false,
      rating: 0,
      archived: false,
      thumbnail,
      mimeType: file.type || (isHeic ? 'image/heic' : ''),
      fileHandle: entry.handle,
      filePath: entry.path,

      // NEW: Structure detection metadata
      sourceFolder,
      folderHierarchy: pathSegments,
      detectedDay: pathAnalysis.detectedDay,
      detectedBucket: pathAnalysis.detectedBucket,
      isPreOrganized: pathAnalysis.isPreOrganized,
      organizationConfidence: pathAnalysis.confidence,
    });
  }

  return photos.sort((a, b) => a.timestamp - b.timestamp);
}
```

**Manual Check**:

1. Import a test folder with organized structure (01_Days/Day 01/A_Establishing/)
2. Verify photos are auto-assigned to correct day/bucket
3. Check that `isPreOrganized` flag is set correctly
4. Verify unorganized photos don't get auto-assigned

---

### 5. Enhanced Folder Detection During Onboarding

**File**: `src/frontend/OnboardingModal.tsx`

Update the `handleDetect` function to scan for bucket subfolders:

```typescript
const handleDetect = useCallback(async () => {
  if (!projectName.trim()) {
    setError('Please enter a project name');
    return;
  }
  if (!dirHandle) {
    setError('Please choose a folder');
    return;
  }
  setError(null);
  setLoading(true);

  try {
    const photoCountMap = new Map<string, number>();
    const folders: string[] = [];
    const folderHandles = new Map<string, FileSystemDirectoryHandle>();

    // @ts-ignore - entries() is supported in modern browsers
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind !== 'directory') continue;
      folders.push(name);
      folderHandles.set(name, handle);

      let count = 0;
      // @ts-ignore
      for await (const [, nested] of handle.entries()) {
        if (nested.kind !== 'file') continue;
        const ext = nested.name.split('.').pop()?.toLowerCase() || '';
        if (['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(ext)) {
          count += 1;
        }
      }
      photoCountMap.set(name, count);
    }

    const detected = detectFolderStructure(folders, { photoCountMap, projectName });

    // NEW: For each detected day folder, scan for bucket subfolders
    const enhancedMappings = await Promise.all(
      detected.map(async mapping => {
        const folderHandle = folderHandles.get(mapping.folder);
        if (!folderHandle || mapping.confidence === 'undetected') {
          return mapping;
        }

        // Scan for bucket subfolders
        const buckets = await detectBucketsInFolder(folderHandle);

        return {
          ...mapping,
          detectedBuckets: buckets,
          isOrganizedStructure: buckets.length > 0,
          bucketConfidence:
            buckets.length > 0
              ? buckets.every(b => b.confidence === 'high')
                ? 'high'
                : 'medium'
              : 'none',
        };
      }),
    );

    const withSkips = enhancedMappings.map(m => ({
      ...m,
      skip: m.confidence === 'undetected' ? true : m.skip ?? false,
    }));

    setMappings(withSkips);
    setStep('preview');
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to detect folder structure');
  } finally {
    setLoading(false);
  }
}, [dirHandle, projectName]);
```

**Manual Check**:

1. Run onboarding with a pre-organized folder
2. Verify that bucket subfolders are detected and shown in preview
3. Check that photo counts are accurate for buckets
4. Verify UI doesn't break with new `detectedBuckets` field

---

## UI Enhancements

### 6. Display Bucket Information in Onboarding Preview

**File**: `src/frontend/OnboardingModal.tsx`

Add bucket information to the folder mapping table:

```tsx
{
  /* After the day number column, add bucket info column */
}
<th className="text-left px-3 py-2 font-medium text-gray-700">Buckets</th>;

{
  /* In the mapping row: */
}
<td className="px-3 py-2">
  {mapping.detectedBuckets && mapping.detectedBuckets.length > 0 ? (
    <div className="flex flex-wrap gap-1">
      {mapping.detectedBuckets.map(bucket => (
        <span
          key={bucket.bucketLetter}
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
          title={`${bucket.folderName} (${bucket.photoCount} photos)`}
        >
          {bucket.bucketLetter}
          <span className="ml-1 text-green-600">({bucket.photoCount})</span>
        </span>
      ))}
    </div>
  ) : (
    <span className="text-xs text-gray-400 italic">None detected</span>
  )}
</td>;
```

**Manual Check**:

1. Verify bucket badges display correctly
2. Check that photo counts are shown
3. Ensure tooltips work on hover
4. Test with folders that have no buckets

---

### 7. Visual Indicator for Pre-Organized Photos

**File**: `src/frontend/PhotoOrganizer.tsx`

Add visual indicator in photo cards/thumbnails:

```tsx
{
  /* In photo card rendering, add badge for pre-organized photos */
}
{
  photo.isPreOrganized && (
    <div className="absolute top-1 left-1 z-10">
      <span
        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-500 text-white"
        title={`Auto-assigned: Day ${photo.detectedDay}, Bucket ${photo.detectedBucket}`}
      >
        <svg className="w-3 h-3 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
          <path
            fillRule="evenodd"
            d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        Organized
      </span>
    </div>
  );
}
```

**Manual Check**:

1. Import pre-organized folder and verify badge appears
2. Check tooltip shows correct day/bucket info
3. Ensure badge doesn't overlap with other UI elements
4. Test with both organized and unorganized photos

---

## Testing Strategy

### Manual Testing Checklist

#### Test Case 1: Pre-Organized Folder (High Confidence)

```
Test Folder Structure:
01_Days/
  Day 01/
    A_Establishing/
      IMG_001.jpg
      IMG_002.jpg
    B_People/
      IMG_003.jpg

Expected Results:
□ All photos detected as isPreOrganized: true
□ IMG_001, IMG_002 assigned to Day 1, Bucket A
□ IMG_003 assigned to Day 1, Bucket B
□ organizationConfidence: 'high'
□ Onboarding preview shows 2 buckets for Day 01
□ Photo cards show "Organized" badge
```

#### Test Case 2: Day Folders Without Buckets (Medium Confidence)

```
Test Folder Structure:
Day 01/
  IMG_001.jpg
Day 02/
  IMG_002.jpg

Expected Results:
□ Photos detected with day numbers
□ detectedDay set correctly (1, 2)
□ detectedBucket: null
□ isPreOrganized: false
□ organizationConfidence: 'medium' or 'low'
□ No bucket badges in onboarding
□ No "Organized" badge on photos
```

#### Test Case 3: Unorganized Folder

```
Test Folder Structure:
Random_Photos/
  IMG_001.jpg
  IMG_002.jpg

Expected Results:
□ detectedDay: null
□ detectedBucket: null
□ isPreOrganized: false
□ organizationConfidence: 'none'
□ Folder marked as "undetected" in onboarding
□ Photos not auto-assigned
```

#### Test Case 4: Mixed Structure

```
Test Folder Structure:
01_Days/
  Day 01/
    A_Establishing/IMG_001.jpg
Inbox/
  IMG_999.jpg

Expected Results:
□ IMG_001: isPreOrganized: true, day: 1, bucket: 'A'
□ IMG_999: isPreOrganized: false, day: null, bucket: null
□ Onboarding shows Day 01 with buckets, Inbox without
□ Only organized photos show badge
```

#### Test Case 5: Custom Bucket Names

```
Test Folder Structure:
Day 01/
  A_CustomName/IMG_001.jpg
  B_MyBucket/IMG_002.jpg

Expected Results:
□ Buckets detected with medium confidence
□ detectedBucket: 'A' for IMG_001
□ detectedBucket: 'B' for IMG_002
□ Onboarding shows bucket badges
□ Photos auto-assigned correctly
```

#### Test Case 6: Numeric Bucket Folders

```
Test Folder Structure:
Day 01/
  01/IMG_001.jpg
  02/IMG_002.jpg

Expected Results:
□ Buckets detected with low confidence
□ detectedBucket: 'A' for IMG_001 (01 → A)
□ detectedBucket: 'B' for IMG_002 (02 → B)
□ organizationConfidence: 'low'
```

---

## Implementation Tasks

### Task 1: Core Service Functions

**Estimated Time**: 3-4 hours

- [ ] Add bucket detection patterns to `folderDetectionService.ts`
- [ ] Implement `detectBucketFromFolderName()` function
- [ ] Implement `analyzePathStructure()` function
- [ ] Implement `detectBucketsInFolder()` async function
- [ ] Add unit tests for bucket detection patterns
- [ ] Test with various naming conventions

**Manual Check Points**:

- [ ] Run unit tests and verify all pass
- [ ] Test pattern matching with edge cases
- [ ] Verify confidence levels are set correctly

---

### Task 2: Data Model Updates

**Estimated Time**: 1-2 hours

- [ ] Update `ProjectPhoto` interface in `projectService.ts`
- [ ] Update `FolderMapping` interface in `folderDetectionService.ts`
- [ ] Add `BucketInfo` interface
- [ ] Update `serializeState()` to include new fields
- [ ] Update `applyEdits()` to handle new fields
- [ ] Ensure backward compatibility with existing saved states

**Manual Check Points**:

- [ ] Open existing project and verify it loads without errors
- [ ] Create new project and verify new fields are saved
- [ ] Check localStorage to confirm new fields are persisted

---

### Task 3: Enhanced Photo Import

**Estimated Time**: 2-3 hours

- [ ] Modify `buildPhotosFromHandle()` to call `analyzePathStructure()`
- [ ] Add folder hierarchy parsing
- [ ] Implement auto-assignment logic for high-confidence detections
- [ ] Add `sourceFolder` extraction
- [ ] Update progress messages
- [ ] Test with various folder structures

**Manual Check Points**:

- [ ] Import pre-organized folder and check auto-assignments
- [ ] Verify `isPreOrganized` flag is accurate
- [ ] Check that unorganized photos aren't auto-assigned
- [ ] Confirm folder hierarchy is captured correctly

---

### Task 4: Onboarding Enhancement

**Estimated Time**: 2-3 hours

- [ ] Update `handleDetect()` in `OnboardingModal.tsx`
- [ ] Add bucket subfolder scanning
- [ ] Enhance folder mappings with bucket info
- [ ] Add UI for displaying detected buckets
- [ ] Style bucket badges and photo counts
- [ ] Test onboarding flow with organized folders

**Manual Check Points**:

- [ ] Run onboarding with organized folder
- [ ] Verify bucket badges display correctly
- [ ] Check photo counts are accurate
- [ ] Test with folders without buckets
- [ ] Ensure UI doesn't break with new data

---

### Task 5: Visual Indicators

**Estimated Time**: 1-2 hours

- [ ] Add "Organized" badge to photo cards in `PhotoOrganizer.tsx`
- [ ] Style badge appropriately
- [ ] Add tooltip with day/bucket info
- [ ] Ensure badge doesn't overlap other elements
- [ ] Test in both gallery and inspect views
- [ ] Add accessibility attributes

**Manual Check Points**:

- [ ] Badge appears on pre-organized photos
- [ ] Badge does not appear on unorganized photos
- [ ] Tooltip shows correct information
- [ ] Badge is visible but not intrusive
- [ ] Keyboard navigation works with badges

---

### Task 6: Testing & Documentation

**Estimated Time**: 2-3 hours

- [ ] Create test folders for all test cases
- [ ] Run manual testing checklist
- [ ] Fix any issues found
- [ ] Update ARCHITECTURE.md with new features
- [ ] Add inline code documentation
- [ ] Create example screenshots

**Manual Check Points**:

- [ ] All test cases pass
- [ ] No regressions in existing functionality
- [ ] Documentation is clear and accurate
- [ ] Code is well-commented

---

## Total Estimated Time

**12-17 hours** (approximately 2-3 days of focused work)

---

## Success Criteria

Phase 1 is complete when:

1. ✅ App correctly detects bucket subfolders in day folders
2. ✅ Photos in organized structures are auto-assigned day/bucket
3. ✅ `isPreOrganized` flag accurately identifies organized photos
4. ✅ Onboarding preview shows bucket information
5. ✅ Photo cards display "Organized" badge for pre-organized photos
6. ✅ All manual test cases pass
7. ✅ No regressions in existing functionality
8. ✅ Code is documented and tested

---

## Dependencies

- None (Phase 1 is self-contained)

---

## Blockers & Risks

### Risk 1: Ambiguous Folder Names

**Issue**: Numeric folders (01, 02) could be days or buckets  
**Mitigation**: Use context (parent folder) and confidence levels

### Risk 2: Performance with Large Folders

**Issue**: Scanning bucket subfolders during onboarding could be slow  
**Mitigation**: Show progress indicator, scan in parallel where possible

### Risk 3: Backward Compatibility

**Issue**: New fields might break existing saved projects  
**Mitigation**: Make all new fields optional, test with existing projects

---

## Follow-up Work

After Phase 1 is complete:

- **Phase 2**: Smart Photo Import (preserve edits during re-import)
- **Phase 3**: Smart Export (only touch changed files)
- **Phase 4**: Folder View UI (tree navigation)
- **Phase 5**: Incremental Updates (add new folders to existing projects)

---

## Questions for Review

Before starting implementation:

1. **Bucket Naming**: Should we support custom bucket naming beyond A-M? (e.g., "X_Selects", "Y_Favorites")
2. **Auto-Assignment**: Should high-confidence detections be editable, or should they be locked?
3. **Confidence Threshold**: At what confidence level should we auto-assign? (currently: 'high' only)
4. **UI Feedback**: Should we show a summary of auto-assignments after import?
5. **Migration Path**: Do we need to provide a way to re-scan existing projects with new detection logic?

---

**End of Phase 1 Implementation Plan**
