import React, { useState, useEffect } from 'react';
import { X, Download, Copy, Info } from 'lucide-react';

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
      <div className="bg-gray-900 rounded-lg max-w-3xl w-full overflow-hidden border border-gray-800 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-800/50">
          <div>
            <h2 className="text-xl font-bold text-gray-100">Export Script</h2>
            <p className="text-sm text-gray-400 mt-1">Organize and copy your photos</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close export script dialog"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[calc(100vh-150px)] overflow-y-auto">
          {/* Project Path Input */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-200">Project Directory</label>
            <input
              type="text"
              value={projectPath}
              onChange={handlePathChange}
              placeholder="/Users/you/Photos/Trip-to-Japan"
              className="w-full px-4 py-3 rounded-lg border border-gray-700 bg-gray-950 text-gray-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <p className="text-xs text-gray-500">Full path to your photo project folder</p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-950/40 border border-blue-900/50 rounded-lg p-3 flex gap-3">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-100">
              <p className="font-medium mb-1">How to use:</p>
              <ol className="text-xs text-blue-200 space-y-1">
                <li>1. Download the script below</li>
                <li>2. Open Terminal in your project folder</li>
                <li>
                  3. Run:{' '}
                  <code className="bg-blue-900/50 px-1.5 py-0.5 rounded font-mono">
                    bash narrative-export.sh
                  </code>
                </li>
              </ol>
            </div>
          </div>

          {/* Script Display */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-200">
                Script (narrative-export.sh)
              </label>
              <span className="text-xs text-gray-500">{scriptText.split('\n').length} lines</span>
            </div>
            <div className="relative">
              <textarea
                readOnly
                value={scriptText}
                className="w-full h-64 rounded-lg border border-gray-800 bg-gray-950 px-4 py-3 text-xs text-gray-100 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              />
              <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-blue-500/30 to-transparent pointer-events-none" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={onDownloadScript}
              className="px-5 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 text-sm font-semibold flex items-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" />
              Download Script
            </button>
            <button
              onClick={onCopyScript}
              className="px-5 py-3 rounded-lg bg-gray-800 text-gray-100 hover:bg-gray-700 active:bg-gray-600 text-sm font-semibold flex items-center gap-2 transition-all"
            >
              <Copy className="w-4 h-4" />
              Copy to Clipboard
            </button>
            {copyStatus === 'copied' && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-950/50 border border-green-900/50">
                <span className="text-sm text-green-300 font-medium">✓ Copied to clipboard!</span>
              </div>
            )}
            {copyStatus === 'failed' && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-950/50 border border-red-900/50">
                <span className="text-sm text-red-300 font-medium">
                  Copy failed. Use download instead.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
