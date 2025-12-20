/**
 * Centralized version management for Narrative
 * Ensures all version references are consistent across the application
 */

// Build-time injected version from package.json
declare const __APP_VERSION__: string;

// Version constants
export const APP_VERSION = __APP_VERSION__;

// Version validation and utilities
export class VersionManager {
  private static instance: VersionManager;
  private version: string;

  private constructor() {
    this.version = APP_VERSION;
  }

  static getInstance(): VersionManager {
    if (!VersionManager.instance) {
      VersionManager.instance = new VersionManager();
    }
    return VersionManager.instance;
  }

  /**
   * Get the current application version
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * Get version formatted for display (e.g., "v1.1.0")
   */
  getDisplayVersion(): string {
    return `v${this.version}`;
  }

  /**
   * Validate that a version string matches the expected format
   */
  isValidVersion(version: string): boolean {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    return semverRegex.test(version);
  }

  /**
   * Check if the current version is valid
   */
  isCurrentVersionValid(): boolean {
    return this.isValidVersion(this.version);
  }

  /**
   * Get version components (major, minor, patch)
   */
  getVersionComponents(): { major: number; minor: number; patch: number } {
    const [major, minor, patch] = this.version.split('.').map(Number);
    return { major, minor, patch };
  }

  /**
   * Compare versions (returns -1 if a < b, 0 if equal, 1 if a > b)
   */
  compareVersions(a: string, b: string): number {
    const aComponents = a.split('.').map(Number);
    const bComponents = b.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (aComponents[i] < bComponents[i]) return -1;
      if (aComponents[i] > bComponents[i]) return 1;
    }
    return 0;
  }

  /**
   * Fetch current version from package.json at runtime (for development robustness)
   */
  async fetchRuntimeVersion(): Promise<string | null> {
    try {
      // Only attempt in development or when explicitly needed
      if (import.meta.env.PROD || import.meta.env.MODE === 'test') {
        return null; // Use build-time version in production or tests
      }

      const response = await fetch('/package.json');
      if (!response.ok) {
        console.warn('Failed to fetch package.json for version check');
        return null;
      }

      const pkg = await response.json();
      return pkg.version || null;
    } catch (error) {
      console.warn('Error fetching runtime version:', error);
      return null;
    }
  }

  /**
   * Get the most current version available (runtime check in dev, build-time otherwise)
   */
  async getCurrentVersion(): Promise<string> {
    // In production, always use build-time version
    if (import.meta.env.PROD) {
      return this.version;
    }

    // In development, try to get runtime version for better DX
    const runtimeVersion = await this.fetchRuntimeVersion();
    return runtimeVersion || this.version;
  }
}

// Export singleton instance
export const versionManager = VersionManager.getInstance();

// Validation function that can be called at runtime
export function validateVersionConsistency(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check if version is defined
  if (!APP_VERSION) {
    errors.push('APP_VERSION is not defined');
  }

  // Check if version format is valid
  if (!versionManager.isCurrentVersionValid()) {
    errors.push(`Invalid version format: ${APP_VERSION}. Expected semver format (x.y.z)`);
  }

  // Check if version is not a placeholder/test version
  if (APP_VERSION === '0.0.0') {
    errors.push('Version is still set to test placeholder (0.0.0)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Development helper - logs version info in development
if (import.meta.env.DEV) {
  console.log('🚀 Narrative Version:', versionManager.getDisplayVersion());

  const validation = validateVersionConsistency();
  if (!validation.isValid) {
    console.warn('⚠️ Version validation issues:', validation.errors);
  }
}
