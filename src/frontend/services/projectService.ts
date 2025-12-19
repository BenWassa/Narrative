export interface ProjectPhoto {
  id: string;
  originalName: string;
  currentName: string;
  timestamp: number;
  day: number | null;
  bucket: string | null;
  sequence: number | null;
  favorite: boolean;
  rating: number;
  archived: boolean;
  thumbnail: string;
  fileHandle?: any; // optional FileSystemFileHandle to allow in-place ops
  filePath?: string;
  metadata?: {
    camera?: string;
    width?: number;
    height?: number;
  };
}

export interface ProjectSettings {
  autoDay: boolean;
  folderStructure: {
    daysFolder: string;
    archiveFolder: string;
    favoritesFolder: string;
    metaFolder: string;
  };
}

export interface ProjectState {
  projectName: string;
  rootPath: string;
  photos: ProjectPhoto[];
  settings: ProjectSettings;
  lastModified?: number;
}

export interface ProjectInitResponse {
  photos: ProjectPhoto[];
  suggestedDays: Record<string, string[]>;
}

const API_BASE =
  (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ||
  'http://localhost:3001/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function initProject(rootPath: string): Promise<ProjectInitResponse> {
  return request('/project/init', {
    method: 'POST',
    body: JSON.stringify({ rootPath }),
  });
}

export function getState(rootPath: string): Promise<ProjectState> {
  const params = new URLSearchParams({ rootPath });
  return request(`/project/state?${params.toString()}`);
}

export async function saveState(rootPath: string, state: ProjectState): Promise<void> {
  await request('/project/state', {
    method: 'POST',
    body: JSON.stringify({ rootPath, state }),
  });
}
