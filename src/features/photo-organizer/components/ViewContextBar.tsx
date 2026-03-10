interface ViewContextBarProps {
  currentView: string;
  selectedDay: number | null;
  selectedRootFolder: string | null;
  hideAssigned: boolean;
  dayLabels: Record<number, string>;
}

export default function ViewContextBar({
  currentView,
  selectedDay,
  selectedRootFolder,
  hideAssigned,
  dayLabels,
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

  const dayLabel =
    selectedDay !== null
      ? dayLabels[selectedDay] || `Day ${String(selectedDay).padStart(2, '0')}`
      : null;

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-gray-800 bg-gray-950/95 px-6 py-2 text-sm backdrop-blur">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        Current View
      </span>
      <span className="rounded bg-gray-800 px-2 py-1 text-gray-200">{viewLabel}</span>

      {dayLabel ? (
        <span className="rounded bg-blue-900/50 px-2 py-1 text-blue-200">{dayLabel}</span>
      ) : null}

      {selectedRootFolder ? (
        <span className="rounded bg-indigo-900/50 px-2 py-1 text-indigo-200">
          Folder: {selectedRootFolder}
        </span>
      ) : null}

      {hideAssigned ? (
        <span className="rounded bg-orange-900/50 px-2 py-1 text-orange-200">Hiding Assigned</span>
      ) : null}
    </div>
  );
}
