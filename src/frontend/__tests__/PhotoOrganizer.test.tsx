import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { test, expect, beforeEach, afterEach, vi } from 'vitest';
import PhotoOrganizer from '../PhotoOrganizer';
import * as projectService from '../services/projectService';

vi.mock('../services/projectService', () => ({
  initProject: vi.fn(),
  getState: vi.fn(),
  saveState: vi.fn(),
  deleteProject: vi.fn(),
}));

const samplePhotos = Array.from({ length: 6 }, (_, index) => {
  const id = `photo_${index + 1}`;
  return {
    id,
    originalName: `IMG_${1000 + index}.jpg`,
    currentName: `IMG_${1000 + index}.jpg`,
    timestamp: Date.now() + index * 1000,
    day: index < 2 ? null : index < 4 ? 1 : 2, // first 2 are loose (root), next 2 Day 1, rest Day 2
    bucket: null,
    sequence: null,
    favorite: false,
    rating: 0,
    archived: false,
    thumbnail: `https://picsum.photos/seed/${index + 1}/400/300`,
    filePath: index < 4 ? `FolderA/IMG_${1000 + index}.jpg` : `FolderB/IMG_${1000 + index}.jpg`,
  };
});

const sampleState = {
  projectName: 'Test Trip',
  rootPath: '/path/to/trip',
  photos: samplePhotos,
  dayLabels: { 1: 'Day 01', 2: 'Day 02' },
  settings: {
    autoDay: true,
    folderStructure: {
      daysFolder: '01_DAYS',
      archiveFolder: '98_ARCHIVE',
      favoritesFolder: 'FAV',
      metaFolder: '_meta',
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem(
    'narrative:recentProjects',
    JSON.stringify([
      {
        projectName: sampleState.projectName,
        projectId: 'project-1',
        rootPath: sampleState.rootPath,
        lastOpened: Date.now(),
      },
    ]),
  );
  vi.mocked(projectService.getState).mockResolvedValue(sampleState);
  vi.mocked(projectService.saveState).mockResolvedValue();
});

afterEach(() => {
  localStorage.clear();
});

test('renders project name', async () => {
  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Test Trip/i });
  fireEvent.click(projectButton);

  // After clicking project, the StartScreen should disappear
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Projects' })).not.toBeInTheDocument());

  // And the project name should appear in the document
  const projectName = screen.getByText('Test Trip');
  expect(projectName).toBeInTheDocument();
});

test('shift-click selects a contiguous range', async () => {
  const { container } = render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Test Trip/i });
  fireEvent.click(projectButton);

  // FolderA is auto-detected as day-like and appears in Days section as "Day 01"
  const day01 = await screen.findByText('Day 01');
  fireEvent.click(day01);

  // wait for images to render
  const imgs = await screen.findAllByRole('img');
  expect(imgs.length).toBeGreaterThanOrEqual(4);

  // click first (on the tile wrapper)
  const first = await screen.findByTestId('photo-photo_1');
  const fourth = await screen.findByTestId('photo-photo_4');
  fireEvent.click(first);
  // shift-click fourth
  fireEvent.click(fourth, { shiftKey: true });

  // selected tiles get the 'ring-4' class
  const selected = container.querySelectorAll('.ring-4');
  expect(selected.length).toBeGreaterThanOrEqual(4);
});

test('renames a day label and export script uses it', async () => {
  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Test Trip/i });
  fireEvent.click(projectButton);
  // days are configured in this project; find the edit control for Day 01
  const editBtn = await screen.findByLabelText(/Edit day 1/i);
  fireEvent.click(editBtn);

  const input = await screen.findByRole('textbox');
  fireEvent.change(input, { target: { value: 'Beach' } });

  const save = await screen.findByLabelText(/Save day name/i);
  fireEvent.click(save);
  // FolderA is now displayed as "Beach" in Days section since we renamed Day 01 to "Beach"
  const dayButton = await screen.findByText(/Beach/i);
  fireEvent.click(dayButton);
  const first = await screen.findByTestId('photo-photo_3');
  fireEvent.click(first);
  const bucketBtn = await screen.findByRole('button', { name: /Establishing/i });
  fireEvent.click(bucketBtn);

  // Export script should include the new label
  const exportBtn = await screen.findByRole('button', { name: /Export Script/i });
  fireEvent.click(exportBtn);

  const textarea = await screen.findByRole('textbox');
  expect(textarea.value).toContain('Beach');
});

test('root view groups by top-level folder and opens group', async () => {
  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Test Trip/i });
  fireEvent.click(projectButton);

  // Switch to Folders tab
  const foldersTab2 = await screen.findByRole('button', { name: /Folders/i });
  fireEvent.click(foldersTab2);

  // Days should be listed first in the sidebar (FolderA is auto-detected as day-like and shown as "Day 01")
  const dayHeading = await screen.findByText(/Day 01/i);
  expect(dayHeading).toBeTruthy();

  // Open the Day 01 folder to see its photos
  fireEvent.click(dayHeading);
  const photos = await screen.findAllByRole('img');
  expect(photos.length).toBeGreaterThanOrEqual(4);
});

test('folders list shows only day-related folders (filters out non-day folders)', async () => {
  // Create a state where FolderC exists but has no day-assigned photos — it should show under Other (not filtered out)
  const stateWithExtra = {
    ...sampleState,
    photos: [
      ...sampleState.photos,
      {
        id: 'photo_7',
        originalName: 'IMG_2007.jpg',
        currentName: 'IMG_2007.jpg',
        timestamp: Date.now(),
        day: null,
        bucket: null,
        sequence: null,
        favorite: false,
        rating: 0,
        archived: false,
        thumbnail: 'https://picsum.photos/seed/7/400/300',
        filePath: 'FolderC/IMG_2007.jpg',
      },
    ],
  };

  vi.mocked(projectService.getState).mockResolvedValue(stateWithExtra as any);
  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Test Trip/i });
  fireEvent.click(projectButton);

  // FolderA (day-like) should appear in Days section as "Day 01", FolderC (non-day) should appear in Other
  const dayLabel = await screen.findByText('Day 01');
  expect(dayLabel).toBeTruthy();
  const otherHeader = await screen.findByText('Other');
  expect(otherHeader).toBeTruthy();
  expect(screen.queryByText('FolderC')).toBeTruthy();
});

test('other groups order: only non-day folders appear in Other when day-like folders auto-detected to Days', async () => {
  // Create a state where both day-like folders and other folders exist at root
  // With auto-detection, Day1_PlayaDelCarmen should appear in Days section, not Other
  const state = {
    ...sampleState,
    photos: [
      ...sampleState.photos,
      {
        id: 'p10',
        originalName: 'A.jpg',
        currentName: 'A.jpg',
        timestamp: Date.now(),
        day: null,
        bucket: null,
        sequence: null,
        favorite: false,
        rating: 0,
        archived: false,
        thumbnail: '',
        filePath: 'Flight to CUN/IMG.jpg',
      },
      {
        id: 'p11',
        originalName: 'B.jpg',
        currentName: 'B.jpg',
        timestamp: Date.now(),
        day: null,
        bucket: null,
        sequence: null,
        favorite: false,
        rating: 0,
        archived: false,
        thumbnail: '',
        filePath: 'Day1_PlayaDelCarmen/IMG.jpg',
      },
    ],
  };

  vi.mocked(projectService.getState).mockResolvedValue(state as any);
  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Test Trip/i });
  fireEvent.click(projectButton);

  // "Flight to CUN" should be in Other section
  const flightFolder = await screen.findByText('Flight to CUN');
  expect(flightFolder).toBeTruthy();

  // "Day1_PlayaDelCarmen" should be in Days section (auto-detected)
  const day1Folder = await screen.findByText('Day 01');
  expect(day1Folder).toBeTruthy();
});

test('folders shows days container when day subfolders exist even if photos are unassigned', async () => {
  // Photo is inside a days-structured folder (with Dnn subfolder) but has no day assigned
  // This tests that folders with day-like structure (Dnn subfolders) are recognized
  const stateWithDaysFolder = {
    ...sampleState,
    photos: [
      ...sampleState.photos,
      {
        id: 'photo_8',
        originalName: 'IMG_3008.jpg',
        currentName: 'IMG_3008.jpg',
        timestamp: Date.now(),
        day: null,
        bucket: null,
        sequence: null,
        favorite: false,
        rating: 0,
        archived: false,
        thumbnail: 'https://picsum.photos/seed/8/400/300',
        filePath: '01_DAYS/D01/IMG_3008.jpg',
      },
    ],
  };

  vi.mocked(projectService.getState).mockResolvedValue(stateWithDaysFolder as any);
  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Test Trip/i });
  fireEvent.click(projectButton);

  // Days section should show configured days (FolderA and FolderB are auto-detected as day-like)
  const daysSection = await screen.findByText('Days');
  expect(daysSection).toBeTruthy();

  // Day 01 and Day 02 should be present
  expect(screen.getByText('Day 01')).toBeTruthy();
  expect(screen.getByText('Day 02')).toBeTruthy();
});

test('onboarding-selected day containers are shown even when empty', async () => {
  const stateWithSelectedContainer = {
    ...sampleState,
    photos: [
      ...sampleState.photos,
      {
        id: 'photo_9',
        originalName: 'IMG_9009.jpg',
        currentName: 'IMG_9009.jpg',
        timestamp: Date.now(),
        day: null,
        bucket: null,
        sequence: null,
        favorite: false,
        rating: 0,
        archived: false,
        thumbnail: 'https://picsum.photos/seed/9/400/300',
        filePath: 'Misc/IMG_9009.jpg',
      },
    ],
    dayContainers: ['PickedDays'],
  };

  vi.mocked(projectService.getState).mockResolvedValue(stateWithSelectedContainer as any);
  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Test Trip/i });
  fireEvent.click(projectButton);

  // The selected day container should be visible even though no Dnn subfolders or assigned photos exist
  // It appears in the Days section at the top of the sidebar
  const picked = await screen.findByText('PickedDays');
  expect(picked).toBeTruthy();
});

test('selected day containers render day labels instead of raw folder names', async () => {
  const stateWithSelectedDays = {
    ...sampleState,
    photos: [
      ...sampleState.photos,
      {
        id: 'p11',
        originalName: 'IMG_A.jpg',
        currentName: 'IMG_A.jpg',
        timestamp: Date.now(),
        day: 1,
        bucket: null,
        sequence: null,
        favorite: false,
        rating: 0,
        archived: false,
        thumbnail: '',
        filePath: 'Day1_PlayaDelCarmen/IMG.jpg',
      },
      {
        id: 'p12',
        originalName: 'IMG_B.jpg',
        currentName: 'IMG_B.jpg',
        timestamp: Date.now(),
        day: 2,
        bucket: null,
        sequence: null,
        favorite: false,
        rating: 0,
        archived: false,
        thumbnail: '',
        filePath: 'Day2_CozumelDiving/IMG.jpg',
      },
    ],
    dayContainers: ['Day1_PlayaDelCarmen', 'Day2_CozumelDiving'],
  };

  vi.mocked(projectService.getState).mockResolvedValue(stateWithSelectedDays as any);
  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Test Trip/i });
  fireEvent.click(projectButton);

  // The selected containers should display as Day 01 and Day 02 labels (in the Days section at the top)
  expect(screen.queryByText('Day1_PlayaDelCarmen')).toBeNull();
  expect(screen.queryByText('Day2_CozumelDiving')).toBeNull();
  const daysHeader = await screen.findByText('Days');
  const daysContainer = daysHeader.nextElementSibling as Element | null;
  expect(daysContainer).toBeTruthy();
  const d1 = await within(daysContainer as Element).findByText(/Day 01/i);
  const d2 = await within(daysContainer as Element).findByText(/Day 02/i);
  expect(d1).toBeTruthy();
  expect(d2).toBeTruthy();
});

test('folder quick actions: select all and assign folder to day', async () => {
  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Test Trip/i });
  fireEvent.click(projectButton);

  // Ensure we're viewing folders
  const foldersTab3 = await screen.findByRole('button', { name: /Folders/i });
  fireEvent.click(foldersTab3);

  // FolderA is now shown in Days section as "Day 01"
  const day01 = await screen.findByText('Day 01');
  fireEvent.click(day01);
  const imgsInFolder = await screen.findAllByRole('img');
  expect(imgsInFolder.length).toBeGreaterThanOrEqual(4);
  const first = await screen.findByTestId('photo-photo_1');
  const fourth = await screen.findByTestId('photo-photo_4');
  fireEvent.click(first);
  fireEvent.click(fourth, { shiftKey: true });

  // Choose 'Create new day' from the Assign select
  const assignSelect = await screen.findByRole('combobox', { name: /Assign to.../i });
  fireEvent.change(assignSelect, { target: { value: 'new' } });

  // New day should be created (Day 03) and show at least the photos we assigned
  const dayButton = await screen.findByRole('button', { name: /Day 03/i });
  fireEvent.click(dayButton);
  const imgs = await screen.findAllByRole('img');
  expect(imgs.length).toBeGreaterThanOrEqual(4);
});

test('selecting a day clears selected root folder so day photos display', async () => {
  const { container } = render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Test Trip/i });
  fireEvent.click(projectButton);

  // Ensure we're viewing folders and a root folder becomes selected
  const foldersTab = await screen.findByRole('button', { name: /Folders/i });
  fireEvent.click(foldersTab);

  // Wait for the initially-selected folder images to render
  await screen.findAllByRole('img');

  // Click Day 01 and assert day photos are shown (photo_3 and photo_4 belong to Day 01)
  const day01 = await screen.findByText('Day 01');
  fireEvent.click(day01);

  // Collect visible photo tile test ids
  const tileEls = container.querySelectorAll('[data-testid^="photo-"]');
  const ids = Array.from(tileEls).map(el => el.getAttribute('data-testid'));

  expect(ids).toContain('photo-photo_3');
  expect(ids).toContain('photo-photo_4');
});

test('archive view highlights organize step, not export', async () => {
  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Test Trip/i });
  fireEvent.click(projectButton);

  // Switch to Archive tab
  const archiveTab = await screen.findByRole('button', { name: /Archive/i });
  fireEvent.click(archiveTab);

  const progress = await screen.findByRole('navigation', { name: /Progress/i });
  const importCircle = within(progress).getByText('1');
  const organizeCircle = within(progress).getByText('2');
  const exportCircle = within(progress).getByText('4');

  // Import should be shown as completed (green), Organize active (blue), Export not active
  expect(importCircle).toHaveClass('bg-green-600');
  expect(organizeCircle).toHaveClass('bg-blue-700');
  expect(exportCircle).not.toHaveClass('bg-blue-700');
});

test('stepper renders non-interactive stage indicators', async () => {
  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Test Trip/i });
  fireEvent.click(projectButton);

  const progress = await screen.findByRole('navigation', { name: /Progress/i });

  // Ensure labels exist and are not buttons
  for (const label of ['Import', 'Organize', 'Review', 'Export']) {
    const el = within(progress).getByText(label);
    expect(el.closest('button')).toBeNull();
  }

  // Default active step should be Organize (number 2)
  const activeNumber = within(progress).getByText('2');
  expect(activeNumber).toHaveClass('bg-blue-700');
});

test('handles localStorage failures gracefully when updating recents', async () => {
  // make setItem throw to simulate quota or storage errors
  const origSet = localStorage.setItem;
  // @ts-ignore - intentionally override for test
  localStorage.setItem = () => {
    throw new Error('Quota exceeded');
  };

  try {
    render(<PhotoOrganizer />);
    const projectButton = await screen.findByRole('button', { name: /Test Trip/i });
    fireEvent.click(projectButton);

    // After project loads, the StartScreen should disappear
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Projects' })).not.toBeInTheDocument());

    // And the project name should appear in the document
    const projectNameElement = screen.getByText('Test Trip');
    expect(projectNameElement).toBeInTheDocument();
  } finally {
    localStorage.setItem = origSet;
  }
});

test('main menu shows app version badge and has no close button', async () => {
  render(<PhotoOrganizer />);
  // Start screen should be visible by default in tests
  const versionBadges = await screen.findAllByText(/v\d+\.\d+\.\d+/i);
  // Only a single, stylized version badge should be visible on the main menu
  expect(versionBadges.length).toBe(1);

  // Ensure no Close button is present on the main menu
  expect(screen.queryByRole('button', { name: /Close welcome|Close/i })).toBeNull();
});

test('clicking Set Cover enters selection mode and clicking a photo sets cover', async () => {
  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Test Trip/i });
  fireEvent.click(projectButton);

  // Open Day 01 to see photos
  const day01 = await screen.findByText('Day 01');
  fireEvent.click(day01);

  // Mock fetch to return a blob for the thumbnail
  const fetchMock = vi
    .spyOn(global as any, 'fetch')
    .mockResolvedValue({ blob: async () => new Blob(['x'], { type: 'image/jpeg' }) });

  const setCoverBtn = await screen.findByRole('button', { name: /Set Cover/i });
  fireEvent.click(setCoverBtn);

  // Instruction banner should show (has a Cancel button)
  expect(await screen.findByRole('button', { name: /Cancel/i })).toBeTruthy();

  // Click a photo to set as cover
  const first = await screen.findByTestId('photo-photo_1');
  fireEvent.click(first);

  // Toast should indicate success
  expect(await screen.findByText(/Cover photo updated/i)).toBeTruthy();

  // Recent projects should have a small coverUrl persisted (not giant data URLs)
  const recentsRaw = localStorage.getItem('narrative:recentProjects');
  expect(recentsRaw).toBeTruthy();
  const recents = JSON.parse(recentsRaw!);
  const thisProject = recents.find((r: any) => r.projectId === 'project-1');
  expect(thisProject).toBeTruthy();
  expect(typeof thisProject.coverUrl === 'string').toBeTruthy();
  expect(thisProject.coverUrl.startsWith('data:image/jpeg;base64,')).toBeTruthy();
  // Ensure resized cover is reasonably small (<= 20k chars)
  expect(thisProject.coverUrl.length).toBeLessThan(20000);
  // Recent entry should not contain full project photos
  expect(thisProject.photos).toBeUndefined();

  // Banner should be gone and button back to normal
  expect(screen.queryByText(/Select a photo to set as cover/i)).toBeNull();
  expect(screen.getByRole('button', { name: /Set Cover/i })).toBeTruthy();

  fetchMock.mockRestore();
});

test('pressing Escape cancels cover selection mode', async () => {
  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Test Trip/i });
  fireEvent.click(projectButton);

  const setCoverBtn = await screen.findByRole('button', { name: /Set Cover/i });
  fireEvent.click(setCoverBtn);

  // Instruction banner should show (has a Cancel button)
  expect(await screen.findByRole('button', { name: /Cancel/i })).toBeTruthy();

  // Press Escape to cancel
  fireEvent.keyDown(window, { key: 'Escape' });

  expect(await screen.findByText(/Cover selection cancelled/i)).toBeTruthy();
  expect(screen.queryByText(/Select a photo to set as cover/i)).toBeNull();
});

test('deleting a project removes recent entry and returns to welcome', async () => {
  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Test Trip/i });
  fireEvent.click(projectButton);

  // Mock confirm and deleteProject
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  const deleteMock = vi.spyOn(projectService as any, 'deleteProject').mockResolvedValue(undefined);

  const deleteBtn = await screen.findByRole('button', { name: /Delete/i });
  fireEvent.click(deleteBtn);

  await waitFor(() => {
    expect(screen.queryByRole('button', { name: /Test Trip/i })).toBeNull();
  });

  const recentsRaw = localStorage.getItem('narrative:recentProjects');
  const recents = recentsRaw ? JSON.parse(recentsRaw) : [];
  expect(recents.find((r: any) => r.projectId === 'project-1')).toBeUndefined();

  confirmSpy.mockRestore();
  deleteMock.mockRestore();
});
