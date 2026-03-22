interface ViewContextBarProps {
  currentView: string;
  selectedTreePath: string | null;
  projectMode: 'single_day' | 'multi_day';
  hideAssigned: boolean;
}

export default function ViewContextBar({
  currentView,
  selectedTreePath,
  projectMode,
  hideAssigned,
}: ViewContextBarProps) {
  const viewLabel =
    currentView === 'folders'
      ? 'Folders'
      : currentView === 'favorites'
      ? 'Favorites'
      : currentView === 'archive'
      ? 'Archive'
      : currentView === 'review'
      ? 'Review'
      : currentView;

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-gray-800 bg-gray-950/95 px-6 py-2 text-sm backdrop-blur">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        Current View
      </span>
      <span className="rounded bg-gray-800 px-2 py-1 text-gray-200">{viewLabel}</span>

      <span className="rounded bg-emerald-900/50 px-2 py-1 text-emerald-200">
        {projectMode === 'single_day' ? 'Single Day' : 'Multi Day'}
      </span>

      {selectedTreePath ? (
        <span className="rounded bg-indigo-900/50 px-2 py-1 text-indigo-200">
          Folder: {selectedTreePath}
        </span>
      ) : null}

      {hideAssigned ? (
        <span className="rounded bg-orange-900/50 px-2 py-1 text-orange-200">Hiding Assigned</span>
      ) : null}
    </div>
  );
}
