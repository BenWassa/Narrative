import { ChevronLeft, Pencil, Trash2, ArrowRightLeft } from 'lucide-react';
import type { ProjectMode, ProjectTreeNode } from '../services/projectService';

interface LeftSidebarProps {
  currentView: string;
  sidebarCollapsed: boolean;
  onCollapseSidebar: () => void;
  onExpandSidebar: () => void;
  tree: ProjectTreeNode[];
  selectedTreePath: string | null;
  onSelectTreePath: (path: string | null) => void;
  onRenameFolder: (path: string, newName: string) => void | Promise<void>;
  onDeleteFolder: (path: string) => void | Promise<void>;
  projectMode: ProjectMode;
  onConvertToMultiDay?: () => void | Promise<void>;
}

function TreeNodeRow({
  node,
  selectedTreePath,
  depth,
  onSelectTreePath,
  onRenameFolder,
  onDeleteFolder,
}: {
  node: ProjectTreeNode;
  selectedTreePath: string | null;
  depth: number;
  onSelectTreePath: (path: string | null) => void;
  onRenameFolder: (path: string, newName: string) => void | Promise<void>;
  onDeleteFolder: (path: string) => void | Promise<void>;
}) {
  const isSelected = selectedTreePath === node.relativePath;
  const indent = 12 + depth * 14;

  return (
    <div>
      <div
        className={`group flex items-center gap-2 rounded px-2 py-2 text-sm transition-colors ${
          isSelected ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
        }`}
        style={{ paddingLeft: indent }}
      >
        <button className="flex-1 text-left" onClick={() => onSelectTreePath(node.relativePath)}>
          <div className="font-medium">{node.name}</div>
          <div className={`text-[11px] ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
            {node.photoCount} photos
          </div>
        </button>
        <button
          onClick={() => {
            const nextName = window.prompt('Rename folder', node.name);
            if (!nextName || nextName === node.name) return;
            onRenameFolder(node.relativePath, nextName);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-black/20 rounded"
          aria-label={`Rename ${node.name}`}
          title="Rename folder"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            const confirmed = window.confirm(
              `Delete folder "${node.relativePath}" and its contents?\n\nThis removes ${node.photoCount} indexed photos from the project and deletes the folder from disk.`,
            );
            if (!confirmed) return;
            onDeleteFolder(node.relativePath);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-black/20 rounded"
          aria-label={`Delete ${node.name}`}
          title="Delete folder"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {node.children.map(child => (
        <TreeNodeRow
          key={child.relativePath}
          node={child}
          selectedTreePath={selectedTreePath}
          depth={depth + 1}
          onSelectTreePath={onSelectTreePath}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
        />
      ))}
    </div>
  );
}

export default function LeftSidebar({
  currentView,
  sidebarCollapsed,
  onCollapseSidebar,
  onExpandSidebar,
  tree,
  selectedTreePath,
  onSelectTreePath,
  onRenameFolder,
  onDeleteFolder,
  projectMode,
  onConvertToMultiDay,
}: LeftSidebarProps) {
  if (currentView !== 'folders') {
    return null;
  }

  if (sidebarCollapsed) {
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

  return (
    <aside className="w-72 border-r border-gray-800 bg-gray-900 overflow-y-auto">
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold uppercase text-gray-400">Project Folders</h3>
            <p className="mt-1 text-[11px] text-gray-500">
              {projectMode === 'single_day'
                ? 'Single-day mode uses root bucket folders.'
                : 'Multi-day mode uses day folders.'}
            </p>
          </div>
          <button
            onClick={onCollapseSidebar}
            className="p-1 hover:bg-gray-800 rounded"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {projectMode === 'single_day' && onConvertToMultiDay ? (
          <button
            onClick={() => onConvertToMultiDay()}
            className="mb-4 w-full rounded-lg border border-indigo-700 bg-indigo-950 px-3 py-2 text-left text-sm text-indigo-200 hover:bg-indigo-900"
          >
            <div className="flex items-center gap-2 font-medium">
              <ArrowRightLeft className="w-4 h-4" />
              Convert To Multi-Day
            </div>
            <div className="mt-1 text-xs text-indigo-300">
              Creates a day folder structure and moves root bucket folders into Day 01.
            </div>
          </button>
        ) : null}

        <div className="space-y-1">
          {tree.length === 0 ? (
            <div className="rounded border border-dashed border-gray-700 px-3 py-4 text-sm text-gray-500">
              No folders available yet.
            </div>
          ) : (
            tree.map(node => (
              <TreeNodeRow
                key={node.relativePath}
                node={node}
                selectedTreePath={selectedTreePath}
                depth={0}
                onSelectTreePath={onSelectTreePath}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
              />
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
