import React from 'react';
import { X, Download, AlertTriangle } from 'lucide-react';

interface UndoScriptModalProps {
  isOpen: boolean;
  scriptText: string;
  onClose: () => void;
  onDownloadScript: () => void;
}

export default function UndoScriptModal({
  isOpen,
  scriptText,
  onClose,
  onDownloadScript,
}: UndoScriptModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-lg max-w-2xl w-full overflow-hidden border border-gray-800">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-semibold text-gray-100">Undo Last Export</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded"
            aria-label="Close undo script dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-5 py-4 space-y-3">
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-200">
                <p className="font-medium mb-1">Warning: This will delete exported files</p>
                <p className="text-yellow-300/80">
                  This script will remove all files created by your last export. 
                  Files are validated by size before deletion for safety.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Undo Script
            </label>
            <p className="text-sm text-gray-400 mb-2">
              Download and run this script to undo your last export:{' '}
              <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">
                bash narrative-undo-export.sh
              </code>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onDownloadScript}
              className="px-4 py-2 rounded-lg bg-yellow-600 text-white hover:bg-yellow-700 text-sm font-medium flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Undo Script
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-lg bg-gray-800 text-gray-100 hover:bg-gray-700 text-sm"
            >
              Cancel
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Script Preview
            </label>
            <textarea
              readOnly
              value={scriptText}
              className="w-full h-48 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-xs text-gray-100 font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
