import groupProjectsByDate from '../utils/groupProjectsByDate';

import { RecentProject } from '../OnboardingModal';

describe('groupProjectsByDate', () => {
  const now = Date.now();
  const oneDay = 1000 * 60 * 60 * 24;

  const sample = [
    { projectName: 'A', projectId: 'p-a', rootPath: '/a', lastOpened: now } as RecentProject,
    { projectName: 'B', projectId: 'p-b', rootPath: '/b', lastOpened: now - oneDay } as RecentProject,
    { projectName: 'C', projectId: 'p-c', rootPath: '/c', lastOpened: now - oneDay * 3 } as RecentProject,
    { projectName: 'D', projectId: 'p-d', rootPath: '/d', lastOpened: now - oneDay * 10 } as RecentProject,
  ];

  test('creates buckets and orders newest-first', () => {
    const groups = groupProjectsByDate(sample);
    expect(groups.length).toBeGreaterThanOrEqual(2);

    const today = groups.find(g => g.label === 'Today');
    expect(today).toBeDefined();
    expect(today!.projects[0].projectName).toBe('A');

    const yesterday = groups.find(g => g.label === 'Yesterday');
    expect(yesterday).toBeDefined();
    expect(yesterday!.projects[0].projectName).toBe('B');

    const earlier = groups.find(g => g.label === 'Earlier' || g.label.match(/\w+ \d+/));
    expect(earlier).toBeDefined();
  });
});
