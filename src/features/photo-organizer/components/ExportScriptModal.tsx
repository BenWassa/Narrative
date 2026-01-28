import React, { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface ExportScriptModalProps {
  isOpen: boolean;
  scriptText: string;
  copyStatus: 'idle' | 'copied' | 'failed';
  detectedProjectPath: string;
  onClose: () => void;
  onCopyScript: () => Promise<void>;
  onDownloadScript: () => void;
  onRegenerateScript: (projectPath: string) => void;
}

export default function ExportScriptModal({
  isOpen,
  scriptText,
  copyStatus,
  detectedProjectPath,
  onClose,
  onCopyScript,
  onDownloadScript,
  onRegenerateScript,
}: ExportScriptModalProps) {
  const [projectPath, setProjectPath] = useState(detectedProjectPath);

  useEffect(() => {
    setProjectPath(detectedProjectPath);
  }, [detectedProjectPath]);

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPath = e.target.value;
    setProjectPath(newPath);
    onRegenerateScript(newPath);
  };

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
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Project Directory Path
            </label>
            <input
              type="text"
              value={projectPath}
              onChange={handlePathChange}
              placeholder="/Users/you/Photos/Trip-to-Japan"
              className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-950 text-gray-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter the full path to your photo project folder
            </p>
          </div>

          <p className="text-sm text-gray-400">
            Download the script and run it:{' '}
            <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">
              bash narrative-export.sh
            </code>
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onDownloadScript}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Script
            </button>
            <button
              onClick={onCopyScript}
              className="px-3 py-2 rounded-lg bg-gray-800 text-gray-100 hover:bg-gray-700 text-sm"
            >
              Copy to Clipboard
            </button>
            {copyStatus === 'copied' && <span className="text-xs text-green-400">Copied!</span>}
            {copyStatus === 'failed' && (
              <span className="text-xs text-red-400">Copy failed. Use download instead.</span>
            )}
          </div>
          <textarea
            readOnly
            value={scriptText}
            className="w-full h-48 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-xs text-gray-100 font-mono"
          />
        </div>
      </div>
    </div>
  );
}
