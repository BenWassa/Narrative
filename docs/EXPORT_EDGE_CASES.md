# Export Script Edge Cases

## Edge Case: Subfolder-Aware MECE Export Logic (Non-Ingested Mode)

### The Problem
When exporting photos in **non-ingested mode** (organizing in-place) that originated from subfolders within a day folder, the system needed to distinguish between:
- Photos from **existing root-level MECE buckets** → keep them untouched
- Photos from **subfolders with MECE buckets** → recreate the MECE structure *inside that subfolder*

### Real-World Scenario
A photographer has mixed organization in Day 02:
```
01_DAYS/Day 02/
  ├─ 02_GoProFootage/
  │   ├─ photo1.mp4 (not yet organized)
  │   ├─ photo2.mp4 (not yet organized)
  │   └─ ...
  ├─ A_Establishing/
  │   ├─ photo3.jpg (already organized)
  │   └─ ...
  ├─ B_People/
  │   ├─ photo4.jpg (already organized)
  │   └─ ...
```

The export should create:
```
01_DAYS/Day 02/
  ├─ 02_GoProFootage/
  │   ├─ A_Establishing/ (NEW)
  │   │   ├─ photo1.mp4
  │   │   └─ photo2.mp4
  │   └─ ...
  ├─ A_Establishing/ (EXISTING - untouched)
  ├─ B_People/ (EXISTING - untouched)
```

NOT overwrite existing root-level buckets.

### Why It Was Difficult

#### 1. Path Interpretation Complexity
The `filePath` contains the full hierarchy, e.g.:
```
01_DAYS/Day 02/02_GoProFootage/A_Establishing/photo.jpg
01_DAYS/Day 02/A_Establishing/photo.jpg
```

Both look similar but require different handling:
- **First**: MECE is inside subfolder → create `Day 02/02_GoProFootage/A_Establishing/`
- **Second**: MECE is at root → create `Day 02/A_Establishing/` (but this already exists!)

The challenge: **detecting which photos need new subfolder-level MECE folders vs. which should go to existing root-level ones.**

#### 2. Grouping Across Multiple Levels
The data structure needed to:
1. Group photos by **day**
2. Then by **bucket** (MECE letter)
3. Then by **subfolder presence** (extract from filePath)

Then reverse it for output:
1. Iterate by **day**
2. Iterate by **subfolder** (if exists)
3. Create **bucket folder inside that subfolder**

This required a complete restructuring of the loop logic, not just a parameter change.

#### 3. Bash Variable Escaping in JavaScript
While implementing the bash script generation, template literals were interpolating bash variables:

```javascript
// WRONG - JavaScript tries to evaluate ${PROJECT_ROOT}
`mkdir -p "${PROJECT_ROOT}/${bucketFolder}"`
// Result: ReferenceError: PROJECT_ROOT is not defined

// CORRECT - Use string concatenation
'mkdir -p "${PROJECT_ROOT}/' + bucketFolder + '"'
// Result: mkdir -p "${PROJECT_ROOT}/Day 02/A_Establishing" (correct bash code)
```

The issue was that JavaScript template literal syntax `${...}` has **higher precedence** than the string concatenation in bash. The solution required switching from template literals to string concatenation for any bash variables.

#### 4. Copy Destination Paths
Files were being copied to **the current working directory** instead of the target folder:

```bash
# WRONG - copies to pwd (the repo directory)
cp "${PROJECT_ROOT}/source/photo.jpg" "destination/photo.jpg"
# File ends up in: /Users/benjaminhaddon/Github Repos/Narrative/destination/

# CORRECT - copies to absolute target path
cp "${PROJECT_ROOT}/source/photo.jpg" "${PROJECT_ROOT}/destination/photo.jpg"
# File ends up in: /Users/benjaminhaddon/Documents/.../destination/
```

All paths needed to be **fully qualified with `${PROJECT_ROOT}` prefix**.

#### 5. Preview vs. Execution Mismatch
The dry-run preview showed the correct nested structure, but the execution logic was generating flat paths:

```
Preview showed:
  Day 02 — 71 photos
    ├─ 📁 02_GoProFootage
    │   ├─ A_Establishing (3)
    │   ├─ B_People (5)

Execution created:
  mkdir -p "${PROJECT_ROOT}/A_Establishing" (at root!)
  cp files to root-level bucket (overwrote existing!)
```

The preview logic used the correct subfolder detection, but the execution code had a flat loop that ignored subfolders entirely.

### The Solution

#### Step 1: Subfolder Detection from filePath
Extract the subfolder name by parsing the file path:

```typescript
const pathParts = p.filePath.split(/[\\/]/).filter(Boolean);
const dayIdx = pathParts.findIndex(part => part === label);

if (dayIdx !== -1 && dayIdx < pathParts.length - 1) {
  const nextPart = pathParts[dayIdx + 1];
  // If nextPart is NOT a bucket folder (doesn't match /^[A-E]_|^M_/), it's a subfolder
  if (nextPart && !nextPart.match(/^[A-E]_|^M_/)) {
    subfolder = nextPart;
  }
}
```

#### Step 2: Dual-Mode Execution Logic
Keep ingested and non-ingested modes completely separate:

```typescript
if (!isIngested) {
  // Non-ingested: Group by subfolder first, then create MECE inside subfolders
  const photosBySubfolder: Record<string, Record<string, ProjectPhoto[]>> = {};
  
  Object.entries(buckets).forEach(([bucket, photos]) => {
    photos.forEach(p => {
      const subfolder = extractSubfolder(p.filePath, label);
      if (!photosBySubfolder[subfolder]) {
        photosBySubfolder[subfolder] = {};
      }
      if (!photosBySubfolder[subfolder][bucket]) {
        photosBySubfolder[subfolder][bucket] = [];
      }
      photosBySubfolder[subfolder][bucket].push(p);
    });
  });

  // Now create folders and copy
  Object.entries(photosBySubfolder).forEach(([subfolder, subfolderBuckets]) => {
    Object.entries(subfolderBuckets).forEach(([bucket, photos]) => {
      const bucketLabel = bucketNames[bucket] || bucket;
      const bucketFolder = subfolder 
        ? `${label}/${subfolder}/${bucket}_${bucketLabel}`
        : `${label}/${bucket}_${bucketLabel}`;
      
      lines.push('mkdir -p "${PROJECT_ROOT}/' + bucketFolder + '"');
      photos.forEach(p => {
        // cp command with full paths
      });
    });
  });
} else {
  // Ingested: Original day-based structure with days folder prefix
  // ... original logic unchanged
}
```

#### Step 3: Absolute Path Enforcement
All bash commands use full `${PROJECT_ROOT}` paths and proper string concatenation:

```typescript
// Create folder
lines.push('mkdir -p "${PROJECT_ROOT}/' + bucketFolder + '"');

// Copy file
lines.push(
  'if [ -e "${PROJECT_ROOT}/' + bucketFolder + '/' + p.currentName + '" ]; ' +
  'then echo "Skipping existing"; ' +
  'else cp "${PROJECT_ROOT}/' + p.filePath + '" "${PROJECT_ROOT}/' + bucketFolder + '/' + p.currentName + '"; fi'
);
```

### Key Takeaways

1. **Structure Matters**: When working with nested hierarchies, the grouping order is critical. Group by deepest level first (subfolder), then work outward.

2. **Language Boundaries**: Mixing JavaScript template literals with bash variable syntax creates subtle bugs. Always use string concatenation for bash variables.

3. **Path Completeness**: Relative paths work locally but fail in scripts. Always use fully-qualified paths with proper variable prefixes.

4. **Preview ≠ Execution**: The preview logic and execution logic must be kept in sync. A mismatch here is dangerous—it looks correct but does something else.

5. **Real Data Preservation**: This edge case matters because it protects existing organized photos from being overwritten. Failure here means data loss.

### Testing Strategy

When implementing export logic with subfolders, test:
1. ✅ Photos from root-level buckets (should not change)
2. ✅ Photos from subfolder buckets (should create inside subfolder)
3. ✅ Mixed: some root, some subfolder in same day
4. ✅ Preview shows correct structure
5. ✅ Execution creates folders in correct locations
6. ✅ Files copy to correct destinations (not to repo root)

### Related Code
- `src/features/photo-organizer/hooks/useExportScript.ts` - buildExportScript() function
- `src/features/photo-organizer/utils/pathResolver.ts` - path resolution utilities
