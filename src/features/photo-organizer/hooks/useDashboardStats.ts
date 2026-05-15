import { useMemo } from 'react';
import type { RecentProject } from '../OnboardingModal';

export function useDashboardStats(recentProjects: RecentProject[]) {
  return useMemo(() => {
    let totalPhotos = 0;
    let totalVideos = 0;
    let assignedCount = 0;
    let inboxCount = 0;
    let archivedCount = 0;

    recentProjects.forEach(project => {
      totalPhotos += project.totalPhotos || 0;
      totalVideos += project.videoCount || 0;
      assignedCount += project.assignedCount || 0;
      inboxCount += project.inboxCount || 0;
      archivedCount += project.archivedCount || 0;
    });

    const totalProjects = recentProjects.length;
    const totalClassified = assignedCount + inboxCount + archivedCount;
    const assignedPercent =
      totalClassified > 0 ? Math.round((assignedCount / totalClassified) * 100) : 0;
    const archivedPercent =
      totalClassified > 0 ? Math.round((archivedCount / totalClassified) * 100) : 0;
    const inboxPercent =
      totalClassified > 0 ? Math.max(0, 100 - assignedPercent - archivedPercent) : 0;

    const mostRecentProject =
      totalProjects > 0
        ? [...recentProjects].sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0))[0]
        : null;

    return {
      totalPhotos,
      totalVideos,
      totalProjects,
      assignedCount,
      inboxCount,
      archivedCount,
      assignedPercent,
      archivedPercent,
      inboxPercent,
      mostRecentProject,
    };
  }, [recentProjects]);
}
