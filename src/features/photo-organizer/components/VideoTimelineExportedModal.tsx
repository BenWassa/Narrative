import React, { useState } from 'react';
import { X, Copy, Check, Terminal } from 'lucide-react';

interface VideoTimelineExportedModalProps {
  isOpen: boolean;
  dayCount: number;
  onClose: () => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_err) {
      // clipboard unavailable
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CommandBlock({ label, command }: { label: string; command: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="flex items-start gap-2 bg-gray-950 border border-gray-800 rounded-lg px-4 py-3">
        <code className="flex-1 text-xs text-gray-100 font-mono break-all leading-relaxed">
          {command}
        </code>
        <CopyButton text={command} />
      </div>
    </div>
  );
}

export default function VideoTimelineExportedModal({
  isOpen,
  dayCount,
  onClose,
}: VideoTimelineExportedModalProps) {
  const [songPath, setSongPath] = useState('~/Music/track.mp3');

  if (!isOpen) return null;

  const beatSyncCmd = `python tools/beat-sync/run.py timeline.json --song ${songPath}`;
  const renderCmd = `python tools/render/recap-v1/render_ffmpeg.py timeline.beat-locked.json --out recap.mp4`;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-lg max-w-xl w-full border border-gray-800 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-800/50">
          <div>
            <h2 className="text-lg font-bold text-gray-100">timeline.json exported</h2>
            <p className="text-sm text-gray-400 mt-0.5">{dayCount} day{dayCount !== 1 ? 's' : ''} — run these two commands to render your video</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Step 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
              <p className="text-sm font-semibold text-gray-200">Beat-sync (set your song path first)</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Song path</label>
              <input
                type="text"
                value={songPath}
                onChange={e => setSongPath(e.target.value)}
                placeholder="~/Music/track.mp3"
                className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-950 text-gray-100 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <CommandBlock label="Run from your project folder" command={beatSyncCmd} />
            <p className="text-xs text-gray-500">Outputs <span className="font-mono text-gray-400">timeline.beat-locked.json</span>. Open it and tweak durations if needed.</p>
          </div>

          <div className="border-t border-gray-800" />

          {/* Step 2 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
              <p className="text-sm font-semibold text-gray-200">Render</p>
            </div>
            <CommandBlock label="Run from your project folder" command={renderCmd} />
            <p className="text-xs text-gray-500">Outputs <span className="font-mono text-gray-400">recap.mp4</span> — import into CapCut to finish.</p>
          </div>

          {/* Terminal hint */}
          <div className="flex items-start gap-2 bg-gray-800/50 rounded-lg px-3 py-2.5">
            <Terminal className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">Open Terminal, <code className="font-mono text-gray-300">cd</code> to your project folder, then run the commands above in order.</p>
          </div>
        </div>

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
