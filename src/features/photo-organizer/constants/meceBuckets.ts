/**
 * MECE (Mutually Exclusive, Collectively Exhaustive) Bucket Definitions
 * 
 * This is the single source of truth for MECE bucket categories.
 * All other parts of the app should reference these definitions to maintain consistency.
 */

export interface MECEBucketDef {
  key: string;
  label: string;
  color: string;
  description: string;
}

/**
 * Official MECE bucket definitions used throughout the app
 */
export const MECE_BUCKETS: MECEBucketDef[] = [
  { key: 'A', label: 'Establishing', color: 'bg-blue-500', description: 'Wide shots, landscapes' },
  { key: 'B', label: 'People', color: 'bg-purple-500', description: 'Portraits, groups' },
  {
    key: 'C',
    label: 'Culture/Detail',
    color: 'bg-green-500',
    description: 'Local life, close-ups',
  },
  { key: 'D', label: 'Action/Moment', color: 'bg-orange-500', description: 'Events, activities' },
  { key: 'E', label: 'Transition', color: 'bg-yellow-500', description: 'Travel, movement' },
  { key: 'M', label: 'Mood/Food', color: 'bg-indigo-500', description: 'Food, mood' },
  { key: 'X', label: 'Archive', color: 'bg-gray-500', description: 'Unwanted shots' },
];

/**
 * Set of valid MECE bucket keys for quick lookup
 */
export const MECE_BUCKET_KEYS = new Set(MECE_BUCKETS.map(bucket => bucket.key));

/**
 * Mapping of bucket keys to display labels
 * Used for export script generation and file naming
 */
export const BUCKET_LABELS: Record<string, string> = {
  A: 'Establishing',
  B: 'People',
  C: 'Culture-Detail',
  D: 'Action-Moment',
  E: 'Transition',
  M: 'Mood-Food',
  X: 'Archive',
};

/**
 * Extract all category names from bucket labels for regex pattern matching
 * This ensures regex patterns stay in sync with bucket definitions
 */
export const BUCKET_CATEGORY_NAMES = Object.values(BUCKET_LABELS).flatMap(label =>
  // Split compound labels like "Culture-Detail" or "Action-Moment" or "Mood-Food" into parts
  label.split('-').map(part => part.trim())
);

/**
 * Check if a folder label is a MECE bucket
 */
export const isMeceBucketLabel = (label: string): boolean => {
  const trimmed = label.trim();
  const firstToken = trimmed.split(/[\s_-]+/)[0] || '';
  return MECE_BUCKET_KEYS.has(firstToken.toUpperCase());
};

/**
 * Helper to get bucket definition by key
 */
export const getBucketDef = (key: string): MECEBucketDef | undefined => {
  return MECE_BUCKETS.find(b => b.key === key);
};

/**
 * Helper to get bucket label by key
 */
export const getBucketLabel = (key: string): string => {
  return BUCKET_LABELS[key] || key;
};
