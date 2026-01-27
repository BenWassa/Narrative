import { RecentProject } from '../OnboardingModal';

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

interface ProjectGroup {
  label: string;
  projects: RecentProject[];
}

export default function groupProjectsByDate(projects: RecentProject[]): ProjectGroup[] {
  if (!projects || projects.length === 0) return [];

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6); // last 7 days includes today

  const buckets: { [key: string]: RecentProject[] } = {};

  projects.forEach(p => {
    const opened = new Date(p.lastOpened);

    let key = 'Earlier';
    if (isSameDay(opened, today)) {
      key = 'Today';
    } else if (isSameDay(opened, yesterday)) {
      key = 'Yesterday';
    } else if (opened >= weekStart) {
      key = 'This week';
    } else {
      // format as month/day for clarity, e.g. "Dec 3"
      key = opened.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    buckets[key] = buckets[key] || [];
    buckets[key].push(p);
  });

  // For deterministic ordering: preferred bucket order
  const order = ['Today', 'Yesterday', 'This week'];
  const groups: ProjectGroup[] = [];

  order.forEach(k => {
    if (buckets[k]) {
      // newest-first
      groups.push({ label: k, projects: buckets[k].sort((a, b) => b.lastOpened - a.lastOpened) });
      delete buckets[k];
    }
  });

  // Add the remaining buckets sorted by date label (parseable ones first)
  const remainingKeys = Object.keys(buckets).sort((a, b) => a.localeCompare(b));
  remainingKeys.forEach(k => {
    groups.push({ label: k, projects: buckets[k].sort((a, b) => b.lastOpened - a.lastOpened) });
  });

  return groups;
}
