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
  detectedBuckets?: BucketInfo[];
  isOrganizedStructure?: boolean;
  bucketConfidence?: 'high' | 'medium' | 'low' | 'none';
}

export interface BucketInfo {
  bucketLetter: string;
  folderName: string;
  photoCount: number;
  confidence: 'high' | 'medium' | 'low';
  patternMatched: string;
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
 * Bucket pattern matchers (in priority order)
 *
 * IMPORTANT: The BUCKET_STANDARD_PATTERN is now dynamically generated from MECE_BUCKETS
 * to ensure consistency between bucket definitions and regex patterns.
 * See src/features/photo-organizer/constants/meceBuckets.ts
 *
 * Note: We use a Unicode hyphen pattern to match various dash types (-, –, —, −, etc.)
 * because macOS and other systems sometimes auto-correct regular hyphens to en/em dashes.
 */

// Unicode-aware hyphen pattern that matches:
// - Regular hyphen (U+002D)
// - En dash (U+2013)
// - Em dash (U+2014)
// - Minus sign (U+2212)
// And underscore + whitespace
const HYPHEN_PATTERN = '[\\s_\\-–—−]';

// Build the standard bucket pattern from MECE bucket definitions
// This ensures the pattern always matches the defined bucket categories
function generateBucketStandardPattern(): RegExp {
  // Import bucket names at runtime to avoid circular dependencies
  // Fallback categories if import fails
  // Note: Use Unicode hyphen pattern inside category definitions
  const categories = [
    'Establishing',
    'People',
    `Culture(?:${HYPHEN_PATTERN}?Detail)?`,
    'Detail',
    `Action(?:${HYPHEN_PATTERN}?Moment)?`,
    'Moment',
    'Transition',
    `(?:Mood${HYPHEN_PATTERN}?Food|Food${HYPHEN_PATTERN}?Mood)`,
    'Mood',
    'Food',
    'Archive',
  ];

  const pattern = `^([A-MX])(?:${HYPHEN_PATTERN}+)(${categories.join('|')})$`;
  return new RegExp(pattern, 'i');
}

const BUCKET_STANDARD_PATTERN = generateBucketStandardPattern();

// Pattern 2: Simple bucket letter (high confidence)
// Matches: "A", "B", "C", "D", "E", "M", "X", etc.
const BUCKET_LETTER_PATTERN = /^([A-MX])$/i;

// Pattern 3: Bucket with custom suffix (medium confidence)
// Matches: "A_Custom", "B_Whatever", "X_Archive", etc.
// Uses Unicode hyphen pattern to handle various dash types
const BUCKET_CUSTOM_PATTERN = new RegExp(`^([A-MX])(?:${HYPHEN_PATTERN}+)(.+)$`, 'i');

// Pattern 4: Numeric bucket folders (low confidence)
// Matches: "01", "02", "03", etc. (could be days or buckets)
const BUCKET_NUMERIC_PATTERN = /^(0[1-6])$/;

const NUMERIC_TO_BUCKET_MAP: Record<string, string> = {
  '01': 'A',
  '02': 'B',
  '03': 'C',
  '04': 'D',
  '05': 'E',
  '06': 'M',
};

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

export function detectDayNumberFromFolderName(
  folderName: string,
  tripStart?: string,
): number | null {
  return extractDayFromFolderName(folderName, tripStart)?.day ?? null;
}

export function detectBucketFromFolderName(
  folderName: string,
): { bucket: string; confidence: 'high' | 'medium' | 'low'; pattern: string } | null {
  // Debug: Log the folder name being tested
  const isDev = typeof window !== 'undefined' && import.meta?.env?.DEV;

  const standardMatch = folderName.match(BUCKET_STANDARD_PATTERN);
  if (standardMatch) {
    if (isDev) {
      console.log('[detectBucket] STANDARD match:', {
        folderName,
        bucket: standardMatch[1].toUpperCase(),
      });
    }
    return {
      bucket: standardMatch[1].toUpperCase(),
      confidence: 'high',
      pattern: 'standard',
    };
  }

  const letterMatch = folderName.match(BUCKET_LETTER_PATTERN);
  if (letterMatch) {
    if (isDev) {
      console.log('[detectBucket] LETTER match:', {
        folderName,
        bucket: letterMatch[1].toUpperCase(),
      });
    }
    return {
      bucket: letterMatch[1].toUpperCase(),
      confidence: 'high',
      pattern: 'letter',
    };
  }

  const customMatch = folderName.match(BUCKET_CUSTOM_PATTERN);
  if (customMatch) {
    return {
      bucket: customMatch[1].toUpperCase(),
      confidence: 'medium',
      pattern: 'custom',
    };
  }

  const numericMatch = folderName.match(BUCKET_NUMERIC_PATTERN);
  if (numericMatch && NUMERIC_TO_BUCKET_MAP[numericMatch[1]]) {
    return {
      bucket: NUMERIC_TO_BUCKET_MAP[numericMatch[1]],
      confidence: 'low',
      pattern: 'numeric',
    };
  }

  // Debug: Log when no pattern matches
  if (isDev && /^[A-MX]/i.test(folderName)) {
    console.warn('[detectBucket] NO MATCH for folder:', folderName, {
      testedPatterns: {
        standard: BUCKET_STANDARD_PATTERN.toString(),
        letter: BUCKET_LETTER_PATTERN.toString(),
        custom: BUCKET_CUSTOM_PATTERN.toString(),
      },
    });
  }

  return null;
}

export function analyzePathStructure(
  filePath: string,
  options?: {
    daysFolder?: string;
  },
): {
  detectedDay: number | null;
  detectedBucket: string | null;
  isPreOrganized: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  pathSegments: string[];
} {
  const daysFolder = options?.daysFolder || '01_DAYS';
  const rawSegments = filePath.split(/[\\/]/).filter(Boolean);
  const pathSegments = rawSegments.length > 0 ? rawSegments.slice(0, -1) : [];

  let detectedDay: number | null = null;
  let detectedBucket: string | null = null;
  let dayConfidence: 'high' | 'medium' | 'low' | 'none' = 'none';
  let bucketConfidence: 'high' | 'medium' | 'low' | 'none' = 'none';

  const daysIndex = pathSegments.findIndex(segment => {
    const lower = segment.toLowerCase();
    return lower === daysFolder.toLowerCase() || lower === '01_days' || lower === 'days';
  });

  if (daysIndex !== -1 && daysIndex < pathSegments.length - 1) {
    const dayFolder = pathSegments[daysIndex + 1];
    const dayDetection = extractDayFromFolderName(dayFolder);

    if (dayDetection) {
      detectedDay = dayDetection.day;
      dayConfidence = dayDetection.confidence;

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
    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      const dayDetection = extractDayFromFolderName(segment);

      if (dayDetection) {
        detectedDay = dayDetection.day;
        dayConfidence = dayDetection.confidence === 'high' ? 'medium' : 'low';

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

  const isPreOrganized = detectedDay !== null && detectedBucket !== null;
  let overallConfidence: 'high' | 'medium' | 'low' | 'none' = 'none';

  if (isPreOrganized) {
    if (dayConfidence === 'high' && bucketConfidence === 'high') {
      overallConfidence = 'high';
    } else if (dayConfidence !== 'none' && bucketConfidence !== 'none') {
      overallConfidence = 'medium';
    } else {
      overallConfidence = 'low';
    }
  } else if (detectedDay !== null) {
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

export async function detectBucketsInFolder(
  dirHandle: FileSystemDirectoryHandle,
): Promise<BucketInfo[]> {
  const buckets: BucketInfo[] = [];
  const supportedExt = ['jpg', 'jpeg', 'png', 'heic', 'webp', 'mp4', 'mov', 'webm', 'avi', 'mkv'];

  try {
    // @ts-ignore - entries() is supported in modern browsers
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind !== 'directory') continue;

      const bucketDetection = detectBucketFromFolderName(name);
      if (!bucketDetection) continue;

      let photoCount = 0;
      // @ts-ignore
      for await (const [fileName, fileHandle] of handle.entries()) {
        if (fileHandle.kind !== 'file') continue;
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        if (supportedExt.includes(ext)) {
          photoCount += 1;
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
  } catch (error) {
    console.warn('Failed to scan for buckets:', error);
  }

  return buckets.sort((a, b) => a.bucketLetter.localeCompare(b.bucketLetter));
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
function generateDryRunSummary(mappings: FolderMapping[]): string {
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
