/**
 * Folder Detection Service
 * Implements heuristics to detect day-based folder structures and generate mapping suggestions.
 */

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
}

/**
 * Pattern matchers for day detection (in priority order)
 */

// Pattern 1: Explicit day prefix (highest confidence)
// Matches: "Day 1", "D01", "day_2", "Day-3", "D1 Iceland", etc.
const DAY_PREFIX_PATTERN = /^(?:day|d)[\s_-]?(\d{1,2})(?:[^\d]|$)/i;

// Pattern 2: ISO date (if trip dates known)
// Matches: "2024-03-15", "2024_03_15", etc.
const ISO_DATE_PATTERN = /(\d{4})-(\d{2})-(\d{2})/;
const ISO_DATE_PATTERN_UNDERSCORES = /(\d{4})_(\d{2})_(\d{2})/;

// Pattern 3: Numeric prefix (ambiguous)
// Matches: "1 Iceland", "02_Reykjavik", "3-Hiking", etc.
const NUMERIC_PREFIX_PATTERN = /^(\d{1,2})[\s_-]/;

// Pattern 4: Timestamp aggregation (lowest confidence)
// Matches: Unix timestamps, ISO dates without dashes
const TIMESTAMP_PATTERN = /(\d{10,13})|(\d{4}(?:\d{2}){2})/;

/**
 * Calculate the day number from a date relative to trip start date
 */
function calculateDayFromDate(dateStr: string, tripStart?: string): number | null {
  try {
    const date = new Date(dateStr);
    const start = tripStart ? new Date(tripStart) : date;

    if (isNaN(date.getTime()) || isNaN(start.getTime())) {
      return null;
    }

    const diffMs = date.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return diffDays + 1; // 1-indexed (day 1 is the first day of the trip)
  } catch {
    return null;
  }
}

/**
 * Extract day number from folder name using patterns
 */
function extractDayFromFolderName(
  folderName: string,
  tripStart?: string,
): { day: number | null; pattern: string; confidence: 'high' | 'medium' | 'low' } | null {
  // Pattern 1: Day prefix (highest confidence)
  const dayPrefixMatch = folderName.match(DAY_PREFIX_PATTERN);
  if (dayPrefixMatch) {
    const day = parseInt(dayPrefixMatch[1], 10);
    if (day >= 1 && day <= 31) {
      return { day, pattern: 'day_prefix', confidence: 'high' };
    }
  }

  // Pattern 2: ISO date (high confidence if trip start is known)
  let isoMatch = folderName.match(ISO_DATE_PATTERN);
  if (isoMatch) {
    const dateStr = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    const day = calculateDayFromDate(dateStr, tripStart);
    if (day !== null) {
      return {
        day,
        pattern: 'iso_date',
        confidence: tripStart ? 'high' : 'medium',
      };
    }
  }

  // Try underscores
  isoMatch = folderName.match(ISO_DATE_PATTERN_UNDERSCORES);
  if (isoMatch) {
    const dateStr = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    const day = calculateDayFromDate(dateStr, tripStart);
    if (day !== null) {
      return {
        day,
        pattern: 'iso_date',
        confidence: tripStart ? 'high' : 'medium',
      };
    }
  }

  // Pattern 3: Numeric prefix (medium confidence, ambiguous)
  const numericMatch = folderName.match(NUMERIC_PREFIX_PATTERN);
  if (numericMatch) {
    const day = parseInt(numericMatch[1], 10);
    if (day >= 1 && day <= 31) {
      return { day, pattern: 'numeric_prefix', confidence: 'medium' };
    }
  }

  return null;
}

/**
 * Suggest a normalized folder name for a detected day
 */
function suggestFolderName(day: number | null): string {
  if (day === null) {
    return 'Unsorted';
  }
  return `Day ${String(day).padStart(2, '0')}`;
}

/**
 * Check if folder name should be skipped (system files, metadata)
 */
function shouldSkipFolder(folderName: string): boolean {
  const skipPatterns = [
    /^\..*/, // Hidden files (.DS_Store, ._*)
    /^unsorted$/i,
    /^inbox$/i,
    /^miscellaneous$/i,
    /^metadata$/i,
    /^_meta$/i,
  ];

  return skipPatterns.some(pattern => pattern.test(folderName));
}

/**
 * Main detection function
 * Analyzes a root directory and returns folder structure mappings
 *
 * @param folders - Array of folder names in the root directory
 * @param photoCountMap - Map of folder name → photo count (optional)
 * @param projectName - Name of the project (to avoid matching as a folder)
 * @param tripStart - Trip start date (YYYY-MM-DD format, optional)
 * @returns Array of FolderMapping objects sorted by detected day
 */
export function detectFolderStructure(
  folders: string[],
  options?: {
    photoCountMap?: Map<string, number>;
    projectName?: string;
    tripStart?: string;
  },
): FolderMapping[] {
  const { photoCountMap = new Map(), projectName = '', tripStart } = options || {};

  const mappings: FolderMapping[] = [];

  for (const folder of folders) {
    // Skip system files and metadata folders
    if (shouldSkipFolder(folder)) {
      continue;
    }

    // Skip folder if it matches project name
    if (projectName && folder.toLowerCase() === projectName.toLowerCase()) {
      continue;
    }

    const photoCount = photoCountMap.get(folder) || 0;

    // Try to extract day from folder name
    const extraction = extractDayFromFolderName(folder, tripStart);

    if (extraction) {
      mappings.push({
        folder,
        folderPath: folder, // In real implementation, would be full path
        detectedDay: extraction.day,
        confidence: extraction.confidence,
        patternMatched: extraction.pattern,
        suggestedName: suggestFolderName(extraction.day),
        manual: false,
        photoCount,
      });
    } else {
      // No match found - mark as undetected but still include in mappings
      mappings.push({
        folder,
        folderPath: folder,
        detectedDay: null,
        confidence: 'undetected',
        patternMatched: 'none',
        suggestedName: suggestFolderName(null),
        manual: false,
        photoCount,
      });
    }
  }

  // Sort by detected day (nulls last)
  mappings.sort((a, b) => {
    if (a.detectedDay === null && b.detectedDay === null) {
      return a.folder.localeCompare(b.folder);
    }
    if (a.detectedDay === null) return 1;
    if (b.detectedDay === null) return -1;
    return a.detectedDay - b.detectedDay;
  });

  return mappings;
}

/**
 * Generate a dry-run summary of what would happen
 */
export function generateDryRunSummary(mappings: FolderMapping[]): string {
  const createCount = mappings.filter(m => m.detectedDay !== null).length;
  const totalPhotos = mappings.reduce((sum, m) => sum + m.photoCount, 0);
  const movedPhotos = mappings
    .filter(m => m.detectedDay !== null)
    .reduce((sum, m) => sum + m.photoCount, 0);
  const skippedPhotos = mappings
    .filter(m => m.detectedDay === null)
    .reduce((sum, m) => sum + m.photoCount, 0);

  let summary = `✓ Create ${createCount} folders:\n`;
  mappings
    .filter(m => m.detectedDay !== null)
    .forEach(m => {
      summary += `  • ${m.suggestedName}/\n`;
    });

  summary += `\n✓ Move ${movedPhotos} photos:\n`;
  mappings
    .filter(m => m.detectedDay !== null)
    .forEach(m => {
      summary += `  • ${m.photoCount} from "${m.folder}" → "${m.suggestedName}/"\n`;
    });

  if (skippedPhotos > 0) {
    summary += `\n○ Skip ${skippedPhotos} photos in undetected folders\n`;
  }

  return summary;
}
