import React from 'react';
import { X } from 'lucide-react';

interface ExportScriptModalProps {
  isOpen: boolean;
  scriptText: string;
  copyStatus: 'idle' | 'copied' | 'failed';
  onClose: () => void;
  onCopyScript: () => Promise<void>;
}

export default function ExportScriptModal({
  isOpen,
  scriptText,
  copyStatus,
  onClose,
  onCopyScript,
}: ExportScriptModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-lg max-w-2xl w-full overflow-hidden border border-gray-800">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100">Export Script</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded"
            aria-label="Close export script dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-400">
            Copy these commands and run them in your terminal from the project root directory. They
            create organized day folders and copy your photos with the current bucket naming.
            Originals are preserved.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onCopyScript}
              className="px-3 py-2 rounded-lg bg-gray-800 text-gray-100 hover:bg-gray-700 text-sm"
            >
              Copy Script
            </button>
            {copyStatus === 'copied' && <span className="text-xs text-green-400">Copied.</span>}
            {copyStatus === 'failed' && (
              <span className="text-xs text-red-400">Copy failed. Select and copy below.</span>
            )}
          </div>
          <textarea
            readOnly
            value={scriptText}
            className="w-full h-64 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-xs text-gray-100 font-mono"
          />
        </div>
      </div>
    </div>
  );
}
