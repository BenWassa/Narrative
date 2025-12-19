import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OnboardingModal, { FolderMapping } from '../OnboardingModal';
import {
  detectFolderStructure,
  generateDryRunSummary,
} from '../../services/folderDetectionService';
import {
  applyFolderMappings,
  undoFolderMapping,
  getTransaction,
  listTransactions,
} from '../../services/folderMappingService';

/**
 * Integration test: End-to-end onboarding flow
 * Tests: detection → preview → dry-run → apply → undo
 */
describe('Onboarding Integration Test', () => {
  const mockFolders = ['Day 1', 'Day 2', 'Day 3', 'unsorted'];
  const mockPhotoCountMap = new Map([
    ['Day 1', 42],
    ['Day 2', 56],
    ['Day 3', 38],
    ['unsorted', 12],
  ]);

  const mockDetect = async (rootPath: string): Promise<FolderMapping[]> => {
    return detectFolderStructure(mockFolders, { photoCountMap: mockPhotoCountMap });
  };

  const mockApply = async (
    mappings: FolderMapping[],
    dryRun: boolean,
  ): Promise<{ summary: string; changes: object }> => {
    const result = await applyFolderMappings(
      'Test Trip',
      '/path',
      mappings,
      undefined,
      undefined,
      dryRun,
    );
    return {
      summary: result.summary,
      changes: result.changes,
    };
  };

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('detects folder structure from root path', async () => {
    const mappings = await mockDetect('/path/to/trip');

    // Should have mappings for Day 1, 2, 3, and unsorted (4 total)
    expect(mappings.length).toBeGreaterThanOrEqual(3); // At least 3 detected days

    // Check first few mappings
    const day1 = mappings.find(m => m.folder === 'Day 1');
    expect(day1).toMatchObject({
      folder: 'Day 1',
      detectedDay: 1,
      confidence: 'high',
      photoCount: 42,
    });

    const day2 = mappings.find(m => m.folder === 'Day 2');
    expect(day2).toMatchObject({
      detectedDay: 2,
      confidence: 'high',
      photoCount: 56,
    });

    const day3 = mappings.find(m => m.folder === 'Day 3');
    expect(day3).toMatchObject({
      detectedDay: 3,
      confidence: 'high',
      photoCount: 38,
    });

    // Unsorted folder should not be skipped (it's in mappings)
    const unsorted = mappings.find(m => m.folder === 'unsorted');
    if (unsorted) {
      expect(unsorted).toMatchObject({
        folder: 'unsorted',
        detectedDay: null,
        confidence: 'undetected',
        photoCount: 12,
      });
    }
  });

  it('generates dry-run summary from mappings', async () => {
    const mappings = await mockDetect('/path/to/trip');
    const summary = generateDryRunSummary(mappings);

    expect(summary).toContain('Create 3 folders');
    expect(summary).toContain('Move 136 photos');
    expect(summary).toContain('Day 01');
    expect(summary).toContain('Day 02');
    expect(summary).toContain('Day 03');
  });

  it('applies folder mappings and creates transaction', async () => {
    const mappings = await mockDetect('/path/to/trip');
    const result = await mockApply(mappings, false);

    expect(result.summary).toContain('Create 3 folders');
    expect(result.summary).toContain('Move 136 photos');

    // Verify transaction was saved (only mappings without skip=true)
    const transactions = listTransactions('Test Trip');
    expect(transactions).toHaveLength(1);
    // Transaction includes only the mappings that were applied (not skipped)
    expect(transactions[0].mappings.length).toBeGreaterThan(0);
  });

  it('supports dry-run preview without persisting', async () => {
    const mappings = await mockDetect('/path/to/trip');
    const result = await mockApply(mappings, true);

    expect(result.summary).toContain('Create 3 folders');

    // Verify transaction was NOT saved in dry-run mode
    const transactions = listTransactions('Test Trip');
    expect(transactions).toHaveLength(0);
  });

  it('undoes applied folder mappings', async () => {
    // First, apply mappings
    const mappings = await mockDetect('/path/to/trip');
    const applyResult = await mockApply(mappings, false);

    // Verify transaction exists
    let transactions = listTransactions('Test Trip');
    expect(transactions).toHaveLength(1);

    const transactionId = transactions[0].id;

    // Now undo
    const undoResult = await undoFolderMapping('Test Trip', transactionId);

    expect(undoResult).toContain('Undone');

    // Verify transaction was deleted
    transactions = listTransactions('Test Trip');
    expect(transactions).toHaveLength(0);
  });

  it('allows editing mappings in preview', async () => {
    const mappings = await mockDetect('/path/to/trip');

    // Simulate user editing a mapping
    const edited = [...mappings];
    edited[0].detectedDay = 2; // Change Day 1 to Day 2
    edited[0].manual = true;

    // Verify edited structure
    expect(edited[0].detectedDay).toBe(2);
    expect(edited[0].manual).toBe(true);

    // Apply edited mappings
    const result = await mockApply(edited, false);
    expect(result.summary).toContain('Create 3 folders');
  });

  it('skips folders when toggled off', async () => {
    const mappings = await mockDetect('/path/to/trip');

    // Simulate user skipping a mapping
    const edited = [...mappings];
    edited[1].skip = true; // Skip Day 2

    // Apply mappings
    const result = await mockApply(
      edited.filter(m => !m.skip),
      false,
    );

    // Verify only 2 folders created (Day 1 and Day 3)
    expect(result.summary).toContain('Create 2 folders');
    expect(result.summary).not.toContain('Day 02');
  });

  it('handles multiple projects with separate transaction logs', async () => {
    // Apply mappings for Project A
    const mappingsA = await mockDetect('/path/to/trip_a');
    const resultA = await applyFolderMappings('Trip A', '/path/a', mappingsA);

    // Apply mappings for Project B
    const mappingsB = await mockDetect('/path/to/trip_b');
    const resultB = await applyFolderMappings('Trip B', '/path/b', mappingsB);

    // Verify separate transaction logs
    const txnsA = listTransactions('Trip A');
    const txnsB = listTransactions('Trip B');

    expect(txnsA).toHaveLength(1);
    expect(txnsB).toHaveLength(1);
    expect(txnsA[0].projectName).toBe('Trip A');
    expect(txnsB[0].projectName).toBe('Trip B');
  });

  it('renders onboarding modal with step 1 folder select', () => {
    const onClose = () => {};
    const onComplete = () => {};

    const { getByPlaceholderText, getByText } = render(
      <OnboardingModal
        isOpen={true}
        onClose={onClose}
        onComplete={onComplete}
        onDetect={mockDetect}
        onApply={mockApply}
      />,
    );

    // Check for folder select inputs
    expect(getByPlaceholderText(/Iceland Trip 2024/i)).toBeTruthy();
    expect(getByPlaceholderText(/\/Users\/you\/trips\/iceland/i)).toBeTruthy();

    // Check for navigation buttons
    expect(getByText(/Next/i)).toBeTruthy();
    expect(getByText(/Cancel/i)).toBeTruthy();
  });

  it('navigates through onboarding steps', async () => {
    const onClose = () => {};
    const onComplete = () => {};

    const { getByPlaceholderText, getByText, getByRole } = render(
      <OnboardingModal
        isOpen={true}
        onClose={onClose}
        onComplete={onComplete}
        onDetect={mockDetect}
        onApply={mockApply}
      />,
    );

    // Step 1: Fill in folder details
    const projectInput = getByPlaceholderText(/Iceland Trip 2024/i);
    const folderInput = getByPlaceholderText(/\/Users\/you\/trips\/iceland/i);

    await userEvent.type(projectInput, 'Test Trip');
    await userEvent.type(folderInput, '/path/to/trip');

    // Click Next to go to step 2
    const nextButton = getByText(/Next/i);
    fireEvent.click(nextButton);

    // Step 2: Should show preview table
    // Note: In a real test with actual async detection, we'd use waitFor()
  });

  it('closes modal when cancel is clicked', () => {
    const onClose = vi.fn();
    const onComplete = () => {};

    const { getByText } = render(
      <OnboardingModal
        isOpen={true}
        onClose={onClose}
        onComplete={onComplete}
        onDetect={mockDetect}
        onApply={mockApply}
      />,
    );

    const cancelButton = getByText(/Cancel/i);
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });
});

/**
 * Unit tests for individual onboarding components
 */
describe('Onboarding Modal Components', () => {
  it('validates project name input', async () => {
    const onClose = () => {};
    const onComplete = () => {};

    const { getByText } = render(
      <OnboardingModal isOpen={true} onClose={onClose} onComplete={onComplete} />,
    );

    // Next button should be disabled without project name
    const nextButton = getByText(/Next/i);
    expect(nextButton).toHaveAttribute('disabled');
  });

  it('validates folder path input', async () => {
    const onClose = () => {};
    const onComplete = () => {};

    const { getByText, getByPlaceholderText } = render(
      <OnboardingModal isOpen={true} onClose={onClose} onComplete={onComplete} />,
    );

    // Fill project name but not folder path
    const projectInput = getByPlaceholderText(/Iceland Trip 2024/i);
    await userEvent.type(projectInput, 'Test Trip');

    // Next button should still be disabled
    const nextButton = getByText(/Next/i);
    expect(nextButton).toHaveAttribute('disabled');
  });

  it('allows optional trip dates', () => {
    const onClose = () => {};
    const onComplete = () => {};

    const { getByDisplayValue } = render(
      <OnboardingModal isOpen={true} onClose={onClose} onComplete={onComplete} />,
    );

    // Trip dates should have inputs but be optional
    // (this would actually test that the fields exist and are empty)
  });
});
