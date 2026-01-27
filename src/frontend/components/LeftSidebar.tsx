import { ChevronLeft, Pencil, Save, X as XIcon } from 'lucide-react';
import { detectDayNumberFromFolderName } from '../../services/folderDetectionService';
import type { ProjectPhoto, ProjectSettings } from '../services/projectService';

interface FolderCategory {
  folder: string;
  items: ProjectPhoto[];
  isSelected: boolean;
  isDayLike: boolean;
  dayNumber: number | null;
  displayName: string;
}

interface LeftSidebarProps {
  currentView: string;
  sidebarCollapsed: boolean;
  onCollapseSidebar: () => void;
  onExpandSidebar: () => void;
  visibleDays: [number, ProjectPhoto[]][];
  selectedDay: number | null;
  selectedRootFolder: string | null;
  onSelectDay: (day: number) => void;
  onSelectRootFolder: (folder: string | null) => void;
  editingDay: number | null;
  editingDayName: string;
  onChangeEditingDayName: (value: string) => void;
  onStartEditingDay: (day: number, name: string) => void;
  onSaveDayName: (day: number) => void;
  onCancelEditingDay: () => void;
  onClearSelectedDay: () => void;
  days: [number, ProjectPhoto[]][];
  dayLabels: Record<number, string>;
  dayContainers: string[];
  photos: ProjectPhoto[];
  normalizePath: (value: string) => string;
  rootGroups: [string, ProjectPhoto[]][];
  displayRootGroups: [string, ProjectPhoto[]][];
  sortFolders: (folders: [string, ProjectPhoto[]][]) => {
    selected: FolderCategory[];
    nonDay: FolderCategory[];
    dayLike: FolderCategory[];
  };
  projectSettings: ProjectSettings;
  debugEnabled: boolean;
}

export default function LeftSidebar({
  currentView,
  sidebarCollapsed,
  onCollapseSidebar,
  onExpandSidebar,
  visibleDays,
  selectedDay,
  selectedRootFolder,
  onSelectDay,
  onSelectRootFolder,
  editingDay,
  editingDayName,
  onChangeEditingDayName,
  onStartEditingDay,
  onSaveDayName,
  onCancelEditingDay,
  onClearSelectedDay,
  days,
  dayLabels,
  dayContainers,
  photos,
  normalizePath,
  rootGroups,
  displayRootGroups,
  sortFolders,
  projectSettings,
  debugEnabled,
}: LeftSidebarProps) {
  if (currentView === 'days' && sidebarCollapsed) {
    return (
      <button
        onClick={onExpandSidebar}
        className="w-12 border-r border-gray-800 bg-gray-900 flex items-center justify-center hover:bg-gray-800 transition-colors"
        aria-label="Expand sidebar"
        title="Expand sidebar"
      >
        <ChevronLeft className="w-4 h-4 text-gray-400 rotate-180" />
      </button>
    );
  }

  if (currentView === 'days') {
    return (
      <aside className="w-48 border-r border-gray-800 bg-gray-900 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase">Days</h3>
            <button
              onClick={onCollapseSidebar}
              className="p-1 hover:bg-gray-800 rounded"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div className="space-y-1">
            {visibleDays.map(([day, dayPhotos]) => (
              <div
                key={day}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onSelectRootFolder(null);
                  onSelectDay(day);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    onSelectRootFolder(null);
                    onSelectDay(day);
                  }
                }}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  selectedDay === day
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-800 text-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  {editingDay === day ? (
                    <div className="flex items-center gap-2 w-full">
                      <input
                        value={editingDayName}
                        onChange={e => onChangeEditingDayName(e.target.value)}
                        className="w-full px-2 py-1 rounded bg-gray-800 text-sm text-gray-100"
                      />
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onSaveDayName(day);
                        }}
                        className="p-1 bg-green-600 rounded"
                        aria-label="Save day name"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onCancelEditingDay();
                        }}
                        className="p-1 bg-gray-800 rounded"
                        aria-label="Cancel"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="font-medium">
                        {dayLabels[day] || `Day ${String(day).padStart(2, '0')}`}
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedDay === day && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onClearSelectedDay();
                            }}
                            className="px-2 py-0.5 rounded bg-gray-800 text-xs text-gray-300 hover:text-white"
                            aria-label="Clear day selection"
                            title="Clear day selection"
                          >
                            Clear
                          </button>
                        )}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onStartEditingDay(
                              day,
                              dayLabels[day] || `Day ${String(day).padStart(2, '0')}`,
                            );
                          }}
                          className="p-1"
                          aria-label={`Edit day ${day}`}
                        >
                          <Pencil className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className="text-xs opacity-70">{dayPhotos.length} photos</div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  if (currentView !== 'folders') return null;

  return (
    <aside className="w-48 border-r border-gray-800 bg-gray-900 overflow-y-auto">
      <div className="p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Days</h3>
        <div className="space-y-1 mb-4">
          {(() => {
            const daysByNumber = new Map<
              number,
              { dayNumber: number; photos: ProjectPhoto[]; folderName: string | null }
            >();
            const selectedContainers = dayContainers || [];
            const selectedTopLevelContainers: string[] = [];
            const selectedPathContainers: string[] = [];
            selectedContainers.forEach(container => {
              const normalized = normalizePath(container);
              if (normalized.includes('/')) {
                selectedPathContainers.push(normalized);
              } else {
                selectedTopLevelContainers.push(normalized);
              }
            });

            const getPhotosForPath = (path: string) => {
              const normalized = normalizePath(path);
              return photos.filter(p => {
                const filePath = normalizePath(p.filePath || p.originalName || '');
                return filePath === normalized || filePath.startsWith(`${normalized}/`);
              });
            };

            days.forEach(([d, photosForDay]) => {
              if (!daysByNumber.has(d)) {
                daysByNumber.set(d, { dayNumber: d, photos: photosForDay, folderName: null });
              }
            });

            selectedPathContainers.forEach(containerPath => {
              const lastSegment = containerPath.split('/').slice(-1)[0];
              const dayNumber = detectDayNumberFromFolderName(lastSegment);
              if (dayNumber == null || daysByNumber.has(dayNumber)) return;
              daysByNumber.set(dayNumber, {
                dayNumber,
                photos: getPhotosForPath(containerPath),
                folderName: containerPath,
              });
            });

            const daysContainer = projectSettings?.folderStructure?.daysFolder;
            if (daysContainer) {
              const normalizedDaysContainer = normalizePath(daysContainer);
              const dayFolderMap = new Map<number, ProjectPhoto[]>();
              photos.forEach(p => {
                const filePath = normalizePath(p.filePath || p.originalName || '');
                const parts = filePath.split('/');
                if (parts.length < 2) return;
                if (parts[0] !== normalizedDaysContainer) return;
                const dayNumber = detectDayNumberFromFolderName(parts[1]);
                if (dayNumber == null) return;
                if (!dayFolderMap.has(dayNumber)) dayFolderMap.set(dayNumber, []);
                dayFolderMap.get(dayNumber)!.push(p);
              });
              dayFolderMap.forEach((dayPhotos, dayNumber) => {
                if (!daysByNumber.has(dayNumber)) {
                  daysByNumber.set(dayNumber, {
                    dayNumber,
                    photos: dayPhotos,
                    folderName: `${normalizedDaysContainer}/${
                      dayLabels[dayNumber] || `Day ${String(dayNumber).padStart(2, '0')}`
                    }`,
                  });
                }
              });
            }

            const categorized = sortFolders(displayRootGroups);
            const categorizedList = [
              ...categorized.selected,
              ...categorized.nonDay,
              ...categorized.dayLike,
            ];
            if (debugEnabled) {
              console.debug('[PhotoOrganizer] Folder categorization:', {
                selected: categorized.selected.map(f => f.folder),
                nonDay: categorized.nonDay.map(f => f.folder),
                dayLike: categorized.dayLike.map(f => f.folder),
              });
            }

            rootGroups.forEach(([folderName, folderPhotos]) => {
              const cat = categorizedList.find(f => f.folder === folderName);
              if (cat && cat.isDayLike && cat.dayNumber !== null && !daysByNumber.has(cat.dayNumber)) {
                const photosForDay = folderPhotos.filter(p => p.day === cat.dayNumber || p.day === null);
                daysByNumber.set(cat.dayNumber, {
                  dayNumber: cat.dayNumber,
                  photos: photosForDay,
                  folderName,
                });
              }
            });

            const displayDays = Array.from(daysByNumber.values()).sort(
              (a, b) => a.dayNumber - b.dayNumber,
            );

            const selectedWithoutDay = selectedTopLevelContainers.filter(containerName => {
              const cat = categorizedList.find(f => f.folder === containerName);
              return cat?.dayNumber === null;
            });

            return (
              <>
                {displayDays.map(entry => (
                  <div
                    key={`day-${entry.dayNumber}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onSelectRootFolder(null);
                      onSelectDay(entry.dayNumber);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        onSelectRootFolder(null);
                        onSelectDay(entry.dayNumber);
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      selectedDay === entry.dayNumber
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-800 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      {editingDay === entry.dayNumber ? (
                        <div className="flex items-center gap-2 w-full">
                          <input
                            value={editingDayName}
                            onChange={e => onChangeEditingDayName(e.target.value)}
                            className="w-full px-2 py-1 rounded bg-gray-800 text-sm text-gray-100"
                          />
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onSaveDayName(entry.dayNumber);
                            }}
                            className="p-1 bg-green-600 rounded"
                            aria-label="Save day name"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onCancelEditingDay();
                            }}
                            className="p-1 bg-gray-800 rounded"
                            aria-label="Cancel"
                          >
                            <XIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="font-medium">
                            {dayLabels[entry.dayNumber] ||
                              `Day ${String(entry.dayNumber).padStart(2, '0')}`}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                onStartEditingDay(
                                  entry.dayNumber,
                                  dayLabels[entry.dayNumber] ||
                                    `Day ${String(entry.dayNumber).padStart(2, '0')}`,
                                );
                              }}
                              className="p-1"
                              aria-label={`Edit day ${entry.dayNumber}`}
                            >
                              <Pencil className="w-4 h-4 text-gray-400" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="text-xs opacity-70">{entry.photos.length} photos</div>
                  </div>
                ))}

                {selectedWithoutDay.map(containerName => (
                  <div
                    key={`container-${containerName}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onSelectRootFolder(containerName);
                      onSelectDay(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      selectedRootFolder === containerName
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-800 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{containerName}</div>
                      <div className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                        Container
                      </div>
                    </div>
                    <div className="text-xs opacity-70">
                      {rootGroups.find(([name]) => name === containerName)?.[1].length || 0} photos
                    </div>
                  </div>
                ))}
              </>
            );
          })()}
        </div>

        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Other</h3>
        <div className="space-y-1">
          {(() => {
            const { selected, nonDay } = sortFolders(displayRootGroups);
            const daysContainer = projectSettings?.folderStructure?.daysFolder;
            const nestedOtherFolders: Array<{ key: string; label: string; items: ProjectPhoto[] }> = [];

            if (daysContainer) {
              const normalizedDaysContainer = normalizePath(daysContainer);
              const nestedMap = new Map<string, ProjectPhoto[]>();
              photos.forEach(p => {
                if (p.archived) return;
                const filePath = normalizePath(p.filePath || p.originalName || '');
                const parts = filePath.split('/');
                if (parts.length < 3) return;
                if (parts[0] !== normalizedDaysContainer) return;
                const dayNumber = detectDayNumberFromFolderName(parts[1]);
                if (dayNumber != null) return;
                const childFolder = parts[1];
                const key = `${normalizedDaysContainer}/${childFolder}`;
                if (!nestedMap.has(key)) nestedMap.set(key, []);
                nestedMap.get(key)!.push(p);
              });

              nestedMap.forEach((items, key) => {
                nestedOtherFolders.push({
                  key,
                  label: key,
                  items,
                });
              });
            }

            const combinedOtherFolders = [
              ...nonDay.map(f => ({
                key: f.folder,
                label: f.folder,
                items: f.items,
              })),
              ...nestedOtherFolders,
            ];

            return (
              <>
                {combinedOtherFolders.map(f => (
                  <div
                    key={f.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onSelectRootFolder(f.key);
                      onSelectDay(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      selectedRootFolder === f.key
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-800 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{f.label}</div>
                      <div className="flex gap-2" />
                    </div>
                    <div className="text-xs opacity-70">
                      {f.items.length} photos ({f.items.filter(p => p.day === null).length} unsorted)
                    </div>
                  </div>
                ))}

                {combinedOtherFolders.length === 0 && (
                  <div className="text-xs text-gray-400">No other folders</div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </aside>
  );
}
