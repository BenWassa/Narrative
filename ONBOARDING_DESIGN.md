# Onboarding Flow Design

## Overview

The onboarding flow enables users to import an existing trip folder, automatically detect day-based folder structures, preview the mapping, and apply it with full undo support.

**Core Principle:** User has complete control. Detection is a suggestion, not automatic. Dry-run before apply. Always reversible.

---

## 1. Detection Heuristics

### 1.1 Folder Naming Patterns (Priority Order)

Detection attempts to parse folder names into a day number using the following regex patterns, in order:

#### Pattern 1: Explicit Day Prefix (Highest Confidence)

```
/^(?:day|d)[\s_-]?(\d{1,2})(?:\D|$)/i
```

Matches: `Day 1`, `D01`, `day_2`, `Day-3`, `D1 Iceland`, etc.

- Extracted day: 1–31
- Confidence: HIGH

#### Pattern 2: ISO Date (Date Known)

```
/(\d{4})-(\d{2})-(\d{2})/
```

Matches: `2024-03-15`, `2024_03_15` (if underscores normalized), etc.

- Extracted day: calculated from trip start date (user provides or detect min date)
- Confidence: HIGH (if trip dates known)
- Fallback: If trip dates not known, store date and ask user to confirm

#### Pattern 3: Numeric Prefix (Ambiguous)

```
/^(\d{1,2})[\s_-]/
```

Matches: `1 Iceland`, `02_Reykjavik`, `3-Hiking`, etc.

- Extracted day: 1–31
- Confidence: MEDIUM (could be photo numbering, could be day numbering)

#### Pattern 4: Timestamp Aggregation (Lowest Confidence)

```
/(\d{10,13})|(\d{4}(?:\d{2}){2})/
```

Matches: Unix timestamps, ISO dates without dashes

- Extract timestamp → round to day boundary
- Group photos by day, infer folder day from median timestamp
- Confidence: LOW (requires photo data; only as fallback)

---

### 1.2 Detection Algorithm

```
Input: rootPath, photos (with timestamps), projectName
Output: FolderMapping[] = [{ folder, detectedDay, confidence, suggestedName, manual }]

ALGORITHM:
1. Scan root directory for subdirectories
2. For each subfolder:
   a. Try patterns 1–3 on folder name
   b. If match found: record (day, pattern, confidence)
   c. If no match: try pattern 4 (timestamp aggregation from photos in folder)
   d. If still no match: day = null, confidence = 'undetected'
3. Return array of mapping objects sorted by day number

SPECIAL CASES:
- If folder name matches project name (e.g., "Iceland Trip 2024"): skip (assume root metadata)
- If folder is named "._*" or ".DS_Store": skip (system files)
- If folder is "unsorted", "inbox", or "miscellaneous": day = null, mark as special
```

---

## 2. Data Structures

### 2.1 Detection Result (Per Folder)

```typescript
interface FolderMapping {
  folder: string; // Folder name (e.g., "Day 1")
  folderPath: string; // Absolute or relative path
  detectedDay: number | null; // Extracted day number (1–31)
  confidence: 'high' | 'medium' | 'low' | 'undetected';
  patternMatched: string; // e.g., 'day_prefix', 'iso_date', 'numeric_prefix', 'timestamp_agg'
  suggestedName: string; // e.g., "Day 01" (normalized format)
  manual: boolean; // User manually edited
  photoCount: number; // Number of photos in folder
  dateRange?: {
    // If extractable from photos or folder name
    start: string; // ISO date string
    end: string; // ISO date string
  };
}
```

### 2.2 Onboarding State (Component Level)

```typescript
interface OnboardingState {
  projectName: string; // User input or default from folder name
  rootPath: string; // Selected folder path
  mappings: FolderMapping[]; // Detection results (editable)
  tripStart?: string; // ISO date, helps with date parsing
  tripEnd?: string; // ISO date, helps with date parsing
  dryRunMode: boolean; // When true, show preview only
  applyInProgress: boolean; // Loading state during apply
  error?: string; // Error message if detection failed
}
```

### 2.3 Persistent Metadata (Written to `_meta/folder_map.json`)

```typescript
interface FolderMapManifest {
  version: '1.0';
  projectName: string;
  rootPath: string;
  createdAt: string; // ISO timestamp
  appliedAt: string; // ISO timestamp (when mappings were applied)
  tripStart?: string; // ISO date
  tripEnd?: string; // ISO date
  mappings: FolderMapping[]; // Final applied mappings
  changes: {
    renamed: { from: string; to: string }[];
    moved: { from: string; to: string }[];
    created: { folder: string; day: number }[];
    skipped: string[];
  };
}
```

---

## 3. UI Specification

### 3.1 Onboarding Modal (Full Flow)

#### Step 1: Folder Selection

**Triggered by:** "Import Trip" button in header (or "New Project" on empty state)

**UI:**

- Modal title: "Import Existing Trip"
- Project name field (text input, prefilled with folder name or "New Project")
- Folder picker (native file dialog or custom tree)
- "Browse" button → open native folder picker
- "Cancel" and "Next >" buttons

**Validation:**

- Folder must exist and be readable
- Folder must not be empty
- Project name must be 1–100 characters

---

#### Step 2: Detection & Preview (Editable Table)

**Triggered by:** User clicks "Next >" from Step 1

**UI:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Import Trip: Iceland Trip 2024                                 │
├─────────────────────────────────────────────────────────────────┤
│ Detected folder structure for ~/trips/iceland/                  │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ Folder Name  │ Detected Day │ Photos │ Confidence │  Action  ││
│ ├──────────────────────────────────────────────────────────────┤│
│ │ Day 1        │ [   1  ▼ ] │   42   │ HIGH ●      │ ○ Skip   ││
│ │ Day 2        │ [   2  ▼ ] │   56   │ HIGH ●      │ ✓ Map    ││
│ │ Day 3        │ [   3  ▼ ] │   38   │ HIGH ●      │ ✓ Map    ││
│ │ unsorted     │ [null  ▼ ] │   12   │ UNDETECTED  │ ○ Skip   ││
│ │ trip_meta    │ [null  ▼ ] │    0   │ UNDETECTED  │ ○ Skip   ││
│ └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│ ☐ Dry-run (preview without making changes)                     │
│                                                                  │
│       [Cancel]  [← Back]  [Apply →]                           │
└─────────────────────────────────────────────────────────────────┘
```

**Behavior:**

- Table rows are editable: clicking on "Detected Day" input allows typing a new value
- Toggling "Skip" removes folder from apply list (visual: gray out row)
- Toggling "Map" includes folder in apply list (visual: highlight row)
- Confidence badges are visual-only (no action)
- Dry-run checkbox: when ON, "Apply" becomes "Preview" and shows a dry-run summary

---

#### Step 3: Dry-Run Preview (Optional)

**Triggered by:** User checks "Dry-run" and clicks "Apply"

**UI:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Dry-Run Preview: Iceland Trip 2024                             │
├─────────────────────────────────────────────────────────────────┤
│ This preview shows what WILL happen if you apply these changes: │
│                                                                  │
│ ✓ Create 3 folders:                                             │
│   • Day 01/                                                     │
│   • Day 02/                                                     │
│   • Day 03/                                                     │
│                                                                  │
│ ✓ Move 136 photos:                                              │
│   • 42 from "Day 1" → "Day 01/"                                 │
│   • 56 from "Day 2" → "Day 02/"                                 │
│   • 38 from "Day 3" → "Day 03/"                                 │
│                                                                  │
│ ○ Skip 12 photos in "unsorted/"                                 │
│                                                                  │
│ ⚠ All changes are REVERSIBLE (undo available)                  │
│                                                                  │
│       [Cancel]  [← Back to Edit]  [Apply for Real →]          │
└─────────────────────────────────────────────────────────────────┘
```

**Behavior:**

- Summary is read-only (no further edits)
- User must confirm by clicking "Apply for Real"
- Cancel returns to Step 2 with edits preserved

---

#### Step 4: Apply & Complete

**Triggered by:** User clicks "Apply for Real" (or "Apply" if dry-run OFF)

**UI:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Applying... Iceland Trip 2024                                  │
├─────────────────────────────────────────────────────────────────┤
│ [████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 50% (68/136 photos)│
│                                                                  │
│ Current: Moving IMG_1052.jpg → Day 02/IMG_1052.jpg             │
└─────────────────────────────────────────────────────────────────┘
```

**After completion:**

```
┌─────────────────────────────────────────────────────────────────┐
│ ✓ Import Complete: Iceland Trip 2024                           │
├─────────────────────────────────────────────────────────────────┤
│ Successfully imported 136 photos into 3 day folders.            │
│                                                                  │
│ Day 01:  42 photos                                              │
│ Day 02:  56 photos                                              │
│ Day 03:  38 photos                                              │
│ Unsorted: 12 photos (skipped)                                   │
│                                                                  │
│ ⚠ To undo all changes, press Cmd+Z (undo available for 1 hour) │
│                                                                  │
│                          [Done]                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Behavior:**

- Modal closes and app loads the new project
- Undo/redo state is initialized with the pre-apply snapshot
- User sees "Days" view showing the 3 new day folders
- Manual messaging encourages use of Cmd+Z for reversibility

---

### 3.2 Component Hierarchy

```
<PhotoOrganizer>
  └─ <OnboardingModal>
      ├─ <FolderSelectStep>          // Step 1
      ├─ <PreviewStep>               // Step 2 + 3
      └─ <ApplyProgress>             // Step 4 (during + after)
```

---

## 4. Storage & Persistence Strategy

### 4.1 Metadata File Location

```
project_root/
  _meta/
    folder_map.json    // Manifest of applied mappings (created after first import)
    undo_snapshot.json // Pre-apply snapshot for undo (written before apply, deleted after confirm)
```

### 4.2 Metadata File Format

**`_meta/folder_map.json`** (persisted, immutable after creation):

```json
{
  "version": "1.0",
  "projectName": "Iceland Trip 2024",
  "rootPath": "/Users/user/trips/iceland",
  "createdAt": "2025-03-15T10:30:00Z",
  "appliedAt": "2025-03-15T10:31:45Z",
  "tripStart": "2024-03-15",
  "tripEnd": "2024-03-17",
  "mappings": [
    {
      "folder": "Day 1",
      "folderPath": "/Users/user/trips/iceland/Day 1",
      "detectedDay": 1,
      "confidence": "high",
      "patternMatched": "day_prefix",
      "suggestedName": "Day 01",
      "manual": false,
      "photoCount": 42
    },
    ...
  ],
  "changes": {
    "renamed": [
      { "from": "Day 1", "to": "Day 01" },
      { "from": "Day 2", "to": "Day 02" }
    ],
    "moved": [
      { "from": "Day 1/IMG_1000.jpg", "to": "Day 01/IMG_1000.jpg" }
    ],
    "created": [
      { "folder": "Day 01", "day": 1 }
    ],
    "skipped": ["unsorted", "trip_meta"]
  }
}
```

### 4.3 Undo Transaction

When user applies mappings:

1. Create `_meta/undo_snapshot.json` with pre-apply filesystem state (list of all files + folder structure)
2. Execute apply operation (move, rename, create folders)
3. If error occurs → rollback using snapshot
4. If success → keep snapshot available for Cmd+Z undo for 1 hour (or until app closes)
5. After successful undo → delete snapshot and restore pre-apply state

---

## 5. Error Handling

### 5.1 Detection Phase Errors

- **No folders found:** Offer to create folder structure or cancel
- **No photos found:** Warn user but allow proceed (in case photos are moved later)
- **Permission denied:** Show error and ask for different folder

### 5.2 Apply Phase Errors

- **File in use:** Skip that file, continue with others, show summary at end
- **Disk space:** Show warning, ask to free space, offer pause/resume
- **Filesystem collision:** If folder already exists with same name, prompt to merge or rename

### 5.3 Undo Phase Errors

- **Snapshot corrupted:** Show error, allow manual recovery
- **Snapshot expired:** Inform user, offer alternative workflows

---

## 6. Implementation Notes

### Backend Service Signature

```typescript
// Detect folder structure from root path
async function detectFolderStructure(
  rootPath: string,
  photos?: Photo[],
  tripStart?: string,
): Promise<FolderMapping[]>;

// Apply mappings to filesystem
async function applyFolderMappings(
  rootPath: string,
  mappings: FolderMapping[],
  dryRun?: boolean,
): Promise<{ summary: string; changes: object; snapshot: object }>;

// Undo mappings using snapshot
async function undoFolderMappings(rootPath: string, snapshot: object): Promise<{ summary: string }>;
```

### Frontend Component Responsibilities

1. Manage onboarding flow state (step, editable mappings, dry-run flag)
2. Display modal with interactive editing
3. Call backend detect → preview → apply functions
4. Integrate result into PhotoOrganizer state (photos, days, undo/redo)
5. Add undo transaction to history

### Next Steps (Phase 2–3)

1. Create `src/frontend/OnboardingModal.tsx` (React component with steps 1–4)
2. Create `src/services/folderDetectionService.ts` (heuristics + backend integration)
3. Implement detection algorithm with regex patterns
4. Add "Import Trip" button to PhotoOrganizer header
5. Integrate onboarding result into photo state

---

## 7. Test Coverage Goals

- ✅ Pattern matching: Each regex tested with 3–5 examples
- ✅ Detection algorithm: Sample folder structures, verify output mapping
- ✅ UI flow: User can select folder → edit mappings → dry-run → apply
- ✅ Undo: Apply → verify changes → Cmd+Z → verify rollback
- ✅ Error cases: Permission denied, file in use, disk full

---

## 8. User Experience Principles

1. **Transparency:** User sees every proposed change before applying
2. **Control:** Every field editable; dry-run before apply; always undo
3. **Safety:** No destructive operations without explicit confirmation
4. **Feedback:** Clear progress during apply; success summary after complete
5. **Recovery:** Undo available for all operations; snapshot preserved for manual recovery
