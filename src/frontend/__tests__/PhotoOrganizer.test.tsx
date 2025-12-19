import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
    day: null,
    bucket: null,
    sequence: null,
    favorite: false,
    rating: 0,
    archived: false,
    thumbnail: `https://picsum.photos/seed/${index + 1}/400/300`,
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
