import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Terminal, Music, ChevronRight } from 'lucide-react';

interface VideoTimelineExportedModalProps {
  isOpen: boolean;
  dayCount: number;
  movedMusicFiles: string[];
  existingMusicFiles: string[];
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
      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors shrink-0"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function defaultSongPath(movedMusicFiles: string[], existingMusicFiles: string[]): string {
  const all = [...movedMusicFiles, ...existingMusicFiles];
  if (all.length >= 1) return `music/${all[0]}`;
  return '~/Music/track.mp3';
}

type StepState = 'idle' | 'done';

interface StepProps {
  index: number;
  label: string;
  command: string;
  note: string;
  state: StepState;
  active: boolean;
  onToggleDone: () => void;
  children?: React.ReactNode;
}

function Step({ index, label, command, note, state, active, onToggleDone, children }: StepProps) {
  const done = state === 'done';

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        done
          ? 'border-green-800/60 bg-green-950/20'
          : active
          ? 'border-blue-700/60 bg-gray-900'
          : 'border-gray-800 bg-gray-900/50 opacity-50'
      }`}
    >
      {/* Step header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div
          className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${
            done
              ? 'bg-green-600 text-white'
              : active
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-400'
          }`}
        >
          {done ? <Check className="w-3.5 h-3.5" /> : index}
        </div>
        <span
          className={`text-sm font-semibold ${
            done ? 'text-green-300' : active ? 'text-gray-100' : 'text-gray-400'
          }`}
        >
          {label}
        </span>
        {done && <span className="ml-auto text-xs text-green-500 font-medium">Complete</span>}
      </div>

      {/* Step body — only visible when active or done */}
      {(active || done) && (
        <div className="px-4 pb-4 space-y-3">
          {children}

          {/* Command block */}
          <div className="flex items-start gap-2 bg-gray-950 border border-gray-800 rounded-lg px-4 py-3">
            <code className="flex-1 text-xs text-gray-100 font-mono break-all leading-relaxed">
              {command}
            </code>
            <CopyButton text={command} />
          </div>

          <p className="text-xs text-gray-500">{note}</p>

          {/* Mark done / undo button */}
          <button
            onClick={onToggleDone}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg transition-colors w-full justify-center ${
              done
                ? 'bg-green-900/40 hover:bg-green-900/60 text-green-300 border border-green-800/50'
                : 'bg-blue-700 hover:bg-blue-600 text-white'
            }`}
          >
            {done ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Done — undo
              </>
            ) : (
              <>
                <ChevronRight className="w-3.5 h-3.5" />
                Mark as done
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default function VideoTimelineExportedModal({
  isOpen,
  dayCount,
  movedMusicFiles,
  existingMusicFiles,
  onClose,
}: VideoTimelineExportedModalProps) {
  const [songPath, setSongPath] = useState(() =>
    defaultSongPath(movedMusicFiles, existingMusicFiles),
  );
  const [step1, setStep1] = useState<StepState>('idle');
  const [step2, setStep2] = useState<StepState>('idle');

  useEffect(() => {
    if (isOpen) {
      setSongPath(defaultSongPath(movedMusicFiles, existingMusicFiles));
      setStep1('idle');
      setStep2('idle');
    }
  }, [isOpen, movedMusicFiles, existingMusicFiles]);

  if (!isOpen) return null;

  const allMusicFiles = [...movedMusicFiles, ...existingMusicFiles];
  const hasMusicFolder = allMusicFiles.length > 0;
  const beatSyncCmd = `beat-sync --song ${songPath}`;
  const renderCmd = `python tools/render/recap-v1/render_ffmpeg.py timeline.beat-locked.json --out recap.mp4`;

  const bothDone = step1 === 'done' && step2 === 'done';
  const step2Active = step1 === 'done';

  let statusText = 'Run these two commands from your project folder';
  if (bothDone) statusText = 'All done — recap.mp4 is ready';
  else if (step2Active) statusText = 'Step 1 complete — now run the render';

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-xl max-w-xl w-full border border-gray-800 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-100">timeline.json exported</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {dayCount} day{dayCount !== 1 ? 's' : ''} — {statusText}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          {/* Music moved notice */}
          {movedMusicFiles.length > 0 && (
            <div className="flex items-start gap-2.5 bg-green-950/40 border border-green-900/50 rounded-lg px-3 py-2.5">
              <Music className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
              <p className="text-xs text-green-200">
                Moved {movedMusicFiles.length} audio file{movedMusicFiles.length !== 1 ? 's' : ''}{' '}
                into <span className="font-mono text-green-100">music/</span>
                {movedMusicFiles.length <= 3 && (
                  <span className="text-green-400"> ({movedMusicFiles.join(', ')})</span>
                )}
              </p>
            </div>
          )}

          {/* Step 1 */}
          <Step
            index={1}
            label="Beat-sync"
            command={beatSyncCmd}
            note="Auto-finds your timeline.json and outputs timeline.beat-locked.json next to it."
            state={step1}
            active={step1 === 'idle'}
            onToggleDone={() => setStep1(s => (s === 'done' ? 'idle' : 'done'))}
          >
            {/* Song selector inside step body */}
            {hasMusicFolder && allMusicFiles.length > 1 ? (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400">Select song from music/</label>
                <select
                  value={songPath}
                  onChange={e => setSongPath(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-950 text-gray-100 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {allMusicFiles.map(f => (
                    <option key={f} value={`music/${f}`}>
                      music/{f}
                    </option>
                  ))}
                  <option value="custom">Custom path…</option>
                </select>
                {songPath === 'custom' && (
                  <input
                    type="text"
                    autoFocus
                    placeholder="~/Music/track.mp3"
                    className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-950 text-gray-100 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onChange={e => setSongPath(e.target.value)}
                  />
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400">Song path</label>
                <input
                  type="text"
                  value={songPath}
                  onChange={e => setSongPath(e.target.value)}
                  placeholder="~/Music/track.mp3"
                  className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-950 text-gray-100 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </Step>

          {/* Step 2 */}
          <Step
            index={2}
            label="Render"
            command={renderCmd}
            note="Outputs recap.mp4 — import into CapCut to finish."
            state={step2}
            active={step2Active}
            onToggleDone={() => setStep2(s => (s === 'done' ? 'idle' : 'done'))}
          />

          {/* Terminal hint */}
          {!bothDone && (
            <div className="flex items-center gap-2 bg-gray-800/40 rounded-lg px-3 py-2.5">
              <Terminal className="w-4 h-4 text-gray-500 shrink-0" />
              <p className="text-xs text-gray-400">
                Open any Terminal window — no need to{' '}
                <code className="font-mono text-gray-300">cd</code> first.
              </p>
            </div>
          )}

          {/* All done banner */}
          {bothDone && (
            <div className="flex items-center gap-2.5 bg-green-950/40 border border-green-800/60 rounded-xl px-4 py-3">
              <Check className="w-5 h-5 text-green-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-300">recap.mp4 is ready</p>
                <p className="text-xs text-green-500 mt-0.5">
                  Import into CapCut to finish editing.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 transition-colors"
          >
            {bothDone ? 'Close' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}
