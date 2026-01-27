import { describe, it, expect, vi } from 'vitest';
import * as coverStorage from '../coverStorageService';

describe('Cover Storage Service (IndexedDB)', () => {
  // IndexedDB tests skipped in test environment - integration tested via PhotoOrganizer
  it.skip('should save and retrieve a cover photo', async () => {
    const projectId = 'test-project-1';
    const blob = new Blob(['test image data'], { type: 'image/jpeg' });
    const coverKey = await coverStorage.saveCover(projectId, blob, 120, 90);
    expect(coverKey).toBeDefined();
  });

  it.skip('should return null for non-existent covers', async () => {
    const retrieved = await coverStorage.getCover('non-existent-project');
    expect(retrieved).toBeNull();
  });

  it.skip('should delete covers', async () => {
    const projectId = 'test-project-3';
    const blob = new Blob(['test image data'], { type: 'image/jpeg' });
    await coverStorage.saveCover(projectId, blob);
    let retrieved = await coverStorage.getCover(projectId);
    expect(retrieved).toBeDefined();
    await coverStorage.deleteCover(projectId);
    retrieved = await coverStorage.getCover(projectId);
    expect(retrieved).toBeNull();
  });

  it('should export all required functions', () => {
    expect(coverStorage.saveCover).toBeDefined();
    expect(coverStorage.getCover).toBeDefined();
    expect(coverStorage.getCoverUrl).toBeDefined();
    expect(coverStorage.deleteCover).toBeDefined();
    expect(coverStorage.getAllCoverMetadata).toBeDefined();
    expect(coverStorage.evictOldCovers).toBeDefined();
    expect(coverStorage.clearAllCovers).toBeDefined();
    expect(coverStorage.getCoverStorageSize).toBeDefined();
    expect(coverStorage.migrateFromLocalStorage).toBeDefined();
  });

  it.skip('should handle migration from localStorage gracefully', async () => {
    const mockProjects = [
      {
        projectId: 'test-1',
        projectName: 'Test Project',
        rootPath: '/test',
        lastOpened: Date.now(),
        coverUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      },
    ];

    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    getItemSpy.mockReturnValue(JSON.stringify(mockProjects));

    const result = await coverStorage.migrateFromLocalStorage('narrative:recentProjects');
    expect(result).toBeDefined();
    expect(result.migrated).toBeGreaterThanOrEqual(0);

    getItemSpy.mockRestore();
  });
});
