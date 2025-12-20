import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { test, expect, beforeEach, afterEach, vi } from 'vitest';
import PhotoOrganizer from '../PhotoOrganizer';
import * as projectService from '../services/projectService';

vi.mock('../services/projectService', () => ({
  initProject: vi.fn(),
  getState: vi.fn(),
  saveState: vi.fn(),
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

  const heading = await screen.findByRole('heading', { level: 1 });
  expect(heading).toHaveTextContent('Test Trip');
});

test('shift-click selects a contiguous range', async () => {
  const { container } = render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Test Trip/i });
  fireEvent.click(projectButton);

  // Select a day first (since default view is now 'days' instead of 'inbox')
  // switch to Days tab (Folders is the default view)
  const daysTab = await screen.findByRole('button', { name: /Days/i });
  fireEvent.click(daysTab);
  const dayButton = await screen.findByRole('button', { name: /(Day 01|Beach)/i });
  fireEvent.click(dayButton);

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

  // switch to Days tab and ensure Day 01 exists and open edit
  const daysTab = await screen.findByRole('button', { name: /Days/i });
  fireEvent.click(daysTab);
  const editBtn = await screen.findByLabelText(/Edit day 1/i);
  fireEvent.click(editBtn);

  const input = await screen.findByRole('textbox');
  fireEvent.change(input, { target: { value: 'Beach' } });

  const save = await screen.findByLabelText(/Save day name/i);
  fireEvent.click(save);
  // select a photo in that day and assign it a category so export will include it
  const dayButton = await screen.findByText(/Beach/i);
  fireEvent.click(dayButton);
  const first = await screen.findByTestId('photo-photo_1');
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

  // Switch to Root tab
  // Switch to Folders tab (folders-first)
  const foldersTab2 = await screen.findByRole('button', { name: /Folders/i });
  fireEvent.click(foldersTab2);

  // Expect folders to be listed
  const folderA = await screen.findByText('FolderA');
  expect(folderA).toBeTruthy();

  // Open FolderA
  fireEvent.click(folderA);
  const photos = await screen.findAllByRole('img');
  expect(photos.length).toBeGreaterThanOrEqual(4);
});

test('folder quick actions: select all and assign folder to day', async () => {
  render(<PhotoOrganizer />);
  const projectButton = await screen.findByRole('button', { name: /Test Trip/i });
  fireEvent.click(projectButton);

  // Ensure we're viewing folders
  const foldersTab3 = await screen.findByRole('button', { name: /Folders/i });
  fireEvent.click(foldersTab3);

  const folderA = await screen.findByText('FolderA');
  // Select all in folder
  const selectBtn = within(folderA.parentElement!).getByRole('button', { name: /Select all photos in FolderA/i });
  fireEvent.click(selectBtn);

  // Right panel should show 4 selected
  expect(await screen.findByText(/4 selected/i)).toBeTruthy();

  // Assign folder to a day (this will create a new day)
  const assignBtn = within(folderA.parentElement!).getByRole('button', { name: /Assign all photos in FolderA to day/i });
  fireEvent.click(assignBtn);

  // Switch to Days tab and expect Day 03 to exist and contain at least 4 photos
  const daysTab = await screen.findByRole('button', { name: /Days/i });
  fireEvent.click(daysTab);
  const dayButton = await screen.findByRole('button', { name: /Day 03/i });
  fireEvent.click(dayButton);
  const imgs = await screen.findAllByRole('img');
  expect(imgs.length).toBeGreaterThanOrEqual(4);

  // Return to folders and ensure Assign button for FolderA is now disabled (all assigned)
  const foldersTab4 = await screen.findByRole('button', { name: /Folders/i });
  fireEvent.click(foldersTab4);
  const updatedFolderA = await screen.findByText('FolderA');
  const updatedAssignBtn = within(updatedFolderA.parentElement!).getByRole('button', { name: /Assign all photos in FolderA to day/i });
  expect(updatedAssignBtn).toBeDisabled();
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

    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Test Trip');
  } finally {
    localStorage.setItem = origSet;
  }
});
