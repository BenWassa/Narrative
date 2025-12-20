import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import PhotoOrganizer from '../PhotoOrganizer';
import safeLocalStorage from '../utils/safeLocalStorage';
import * as projectService from '../services/projectService';

vi.mock('../services/projectService', () => ({
  getState: vi.fn(),
  saveState: vi.fn(),
  initProject: vi.fn(),
}));

const ACTIVE_PROJECT_KEY = 'narrative:activeProject';

describe('PhotoOrganizer header contrast helpers', () => {
  afterEach(() => {
    safeLocalStorage.remove(ACTIVE_PROJECT_KEY);
    vi.clearAllMocks();
  });

  it('renders project name with a high-contrast color class', async () => {
    safeLocalStorage.set(ACTIVE_PROJECT_KEY, 'project-1');
    vi.mocked(projectService.getState).mockResolvedValue({
      projectName: 'Test Trip',
      rootPath: 'Test Trip',
      photos: [],
      settings: {
        autoDay: true,
        folderStructure: {
          daysFolder: '01_DAYS',
          archiveFolder: '98_ARCHIVE',
          favoritesFolder: 'FAV',
          metaFolder: '_meta',
        },
      },
      dayLabels: {},
      dayContainers: [],
    } as any);

    render(<PhotoOrganizer />);

    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    // ensure we explicitly apply a high-contrast color class
    expect(heading.className).toContain('text-gray-100');
  });
});
