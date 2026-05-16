import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, Terminal, Music, Loader2, AlertTriangle } from 'lucide-react';
import { getHandle } from '../services/projectService';

interface VideoTimelineExportedModalProps {
  isOpen: boolean;
  dayCount: number;
  clipCount: number;
  movedMusicFiles: string[];
  existingMusicFiles: string[];
  projectRootPath: string | null;
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

async function fileExists(handle: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await handle.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

function formatMmSs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds - m * 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Pacing {
  verdict: 'rushed' | 'fast' | 'good' | 'slow';
  label: string;
  perClip: number;
}

function getPacing(songDuration: number, clipCount: number): Pacing | null {
  if (clipCount <= 0 || songDuration <= 0) return null;
  const perClip = songDuration / clipCount;
  if (perClip < 1.0) return { verdict: 'rushed', label: 'too rushed', perClip };
  if (perClip < 2.0) return { verdict: 'fast', label: 'fast montage', perClip };
  if (perClip <= 6.0) return { verdict: 'good', label: 'good pacing', perClip };
  return { verdict: 'slow', label: 'slow pace', perClip };
}

async function loadAudioDuration(file: File): Promise<number | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const d = audio.duration;
      URL.revokeObjectURL(url);
      resolve(isFinite(d) ? d : null);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    audio.src = url;
  });
}

interface StepProps {
  index: number;
  label: string;
  command: string;
  note: string;
  done: boolean;
  active: boolean;
  waiting: boolean;
  children?: React.ReactNode;
}

function Step({ index, label, command, note, done, active, waiting, children }: StepProps) {
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
        {waiting && (
          <span className="ml-auto flex items-center gap-1 text-xs text-blue-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            Waiting…
          </span>
        )}
      </div>

      {(active || done) && (
        <div className="px-4 pb-4 space-y-3">
          {children}

          <div className="flex items-start gap-2 bg-gray-950 border border-gray-800 rounded-lg px-4 py-3">
            <code className="flex-1 text-xs text-gray-100 font-mono break-all leading-relaxed">
              {command}
            </code>
            <CopyButton text={command} />
          </div>

          <p className="text-xs text-gray-500">{note}</p>
        </div>
      )}
    </div>
  );
}

export default function VideoTimelineExportedModal({
  isOpen,
  dayCount,
  clipCount,
  movedMusicFiles,
  existingMusicFiles,
  projectRootPath,
  onClose,
}: VideoTimelineExportedModalProps) {
  const [songPath, setSongPath] = useState(() =>
    defaultSongPath(movedMusicFiles, existingMusicFiles),
  );
  const [songDurations, setSongDurations] = useState<Record<string, number>>({});
  const [step1Done, setStep1Done] = useState(false);
  const [step2Done, setStep2Done] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSongPath(defaultSongPath(movedMusicFiles, existingMusicFiles));
      setStep1Done(false);
      setStep2Done(false);
    }
  }, [isOpen, movedMusicFiles, existingMusicFiles]);

  // Load durations for music files when modal opens
  useEffect(() => {
    if (!isOpen || !projectRootPath) return;
    const files = [...movedMusicFiles, ...existingMusicFiles];
    if (files.length === 0) return;

    let cancelled = false;
    (async () => {
      const handle = await getHandle(projectRootPath);
      if (!handle) return;
      let musicDir: FileSystemDirectoryHandle;
      try {
        musicDir = await handle.getDirectoryHandle('music');
      } catch {
        return;
      }
      const next: Record<string, number> = {};
      for (const name of files) {
        if (cancelled) return;
        try {
          const fileHandle = await musicDir.getFileHandle(name);
          const file = await fileHandle.getFile();
          const dur = await loadAudioDuration(file);
          if (dur !== null) next[name] = dur;
        } catch {
          // skip
        }
      }
      if (!cancelled) setSongDurations(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, projectRootPath, movedMusicFiles, existingMusicFiles]);

  // Poll for output files every 2s while modal is open
  useEffect(() => {
    if (!isOpen || !projectRootPath) return;

    const poll = async () => {
      const handle = await getHandle(projectRootPath);
      if (!handle) return;
      const [beatLocked, recap] = await Promise.all([
        fileExists(handle, 'timeline.beat-locked.json'),
        fileExists(handle, 'recap.mp4'),
      ]);
      setStep1Done(beatLocked);
      setStep2Done(recap);
    };

    poll();
    intervalRef.current = setInterval(poll, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOpen, projectRootPath]);

  if (!isOpen) return null;

  const allMusicFiles = [...movedMusicFiles, ...existingMusicFiles];
  const hasMusicFolder = allMusicFiles.length > 0;
  const beatSyncCmd = `beat-sync --song ${songPath}`;
  const renderCmd = `render`;

  const selectedSongName = songPath.startsWith('music/') ? songPath.slice('music/'.length) : null;
  const selectedDuration = selectedSongName ? songDurations[selectedSongName] : undefined;
  const pacing = selectedDuration ? getPacing(selectedDuration, clipCount) : null;

  const pacingColors = {
    rushed: 'text-red-300 bg-red-950/40 border-red-900/50',
    fast: 'text-amber-300 bg-amber-950/40 border-amber-900/50',
    good: 'text-green-300 bg-green-950/40 border-green-900/50',
    slow: 'text-amber-300 bg-amber-950/40 border-amber-900/50',
  };

  const bothDone = step1Done && step2Done;
  const step2Active = step1Done;

  let statusText = 'Run these two commands from any terminal window';
  if (bothDone) statusText = 'All done — recap.mp4 is ready';
  else if (step2Active) statusText = 'Beat-sync done — now run the render';

  const songOptionLabel = (name: string) => {
    const d = songDurations[name];
    if (!d) return `music/${name}`;
    const pace = getPacing(d, clipCount);
    if (!pace) return `music/${name} (${formatMmSs(d)})`;
    return `music/${name} (${formatMmSs(d)} — ${pace.perClip.toFixed(1)}s/clip, ${pace.label})`;
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-xl max-w-xl w-full border border-gray-800 shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-100">timeline.json exported</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {dayCount} day{dayCount !== 1 ? 's' : ''}, {clipCount} clip
              {clipCount !== 1 ? 's' : ''} — {statusText}
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

          <Step
            index={1}
            label="Beat-sync"
            command={beatSyncCmd}
            note="Auto-finds your timeline.json and outputs timeline.beat-locked.json next to it."
            done={step1Done}
            active={!step1Done}
            waiting={!step1Done}
          >
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
                      {songOptionLabel(f)}
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
                <label className="text-xs text-gray-400">
                  Song path
                  {selectedDuration && (
                    <span className="text-gray-500 ml-2">
                      ({formatMmSs(selectedDuration)}
                      {pacing && ` — ${pacing.perClip.toFixed(1)}s/clip`})
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={songPath}
                  onChange={e => setSongPath(e.target.value)}
                  placeholder="~/Music/track.mp3"
                  className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-950 text-gray-100 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {pacing && (
              <div
                className={`flex items-start gap-2 border rounded-lg px-3 py-2 ${
                  pacingColors[pacing.verdict]
                }`}
              >
                {pacing.verdict === 'good' ? (
                  <Check className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <p className="text-xs">
                  {clipCount} clips ÷ {formatMmSs(selectedDuration!)} ={' '}
                  <span className="font-semibold">{pacing.perClip.toFixed(1)}s per clip</span> —{' '}
                  {pacing.label}
                  {pacing.verdict === 'rushed' && ' — pick a longer song or fewer clips.'}
                  {pacing.verdict === 'slow' && ' — pick a shorter song or add more clips.'}
                  {pacing.verdict === 'fast' && ' — fine for montage style.'}
                </p>
              </div>
            )}
          </Step>

          <Step
            index={2}
            label="Render"
            command={renderCmd}
            note="Auto-finds the beat-locked timeline and writes recap.mp4 next to it."
            done={step2Done}
            active={step2Active && !step2Done}
            waiting={step2Active && !step2Done}
          />

          {!bothDone && (
            <div className="flex items-center gap-2 bg-gray-800/40 rounded-lg px-3 py-2.5">
              <Terminal className="w-4 h-4 text-gray-500 shrink-0" />
              <p className="text-xs text-gray-400">
                Open any Terminal window — no need to{' '}
                <code className="font-mono text-gray-300">cd</code> first. Requires{' '}
                <code className="font-mono text-gray-300">ffmpeg</code> (
                <code className="font-mono text-gray-300">brew install ffmpeg</code>).
              </p>
            </div>
          )}

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
