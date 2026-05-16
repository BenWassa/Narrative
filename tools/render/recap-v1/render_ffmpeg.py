#!/usr/bin/env python3
"""Draft ffmpeg renderer for Narrative beat-locked timelines.

This is deliberately plain: it creates a concat list using photos as looping
video inputs and trims video clips with the `in_out_sec` values from beat-sync.
HyperFrames can consume the same timeline through composition.js when available.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def is_video(item: dict[str, Any]) -> bool:
    return item.get("kind") == "video"


def render_clip(item: dict[str, Any], base_dir: Path, out: Path, resolution: tuple[int, int]) -> None:
    source = base_dir / item["path"]
    duration = float(item.get("duration_sec") or 2)
    width, height = resolution
    vf = f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},format=yuv420p"

    if is_video(item):
        in_out = item.get("in_out_sec") or [0, duration]
        run(
            [
                "ffmpeg",
                "-y",
                "-ss",
                str(in_out[0]),
                "-t",
                str(duration),
                "-i",
                str(source),
                "-an",
                "-vf",
                vf,
                str(out),
            ]
        )
        return

    run(
        [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-t",
            str(duration),
            "-i",
            str(source),
            "-vf",
            vf,
            str(out),
        ]
    )


def find_beat_locked_timeline() -> Path:
    """Return the most recently modified timeline.beat-locked.json under ~/."""
    home = Path.home()
    candidates: list[tuple[float, Path]] = []
    skip_parts = {"node_modules", ".venv", "__pycache__"}
    for root, dirs, files in os.walk(home):
        dirs[:] = [d for d in dirs if d not in skip_parts and not d.startswith(".")]
        if "timeline.beat-locked.json" in files:
            p = Path(root) / "timeline.beat-locked.json"
            candidates.append((p.stat().st_mtime, p))

    if not candidates:
        print("render: no timeline.beat-locked.json found under ~/ — run beat-sync first", file=sys.stderr)
        sys.exit(1)

    candidates.sort(reverse=True)
    chosen = candidates[0][1]
    if len(candidates) > 1:
        print(f"render: found {len(candidates)} beat-locked timelines, using most recent: {chosen}")
    return chosen


def main() -> None:
    parser = argparse.ArgumentParser(description="Render a draft recap MP4 from timeline.beat-locked.json")
    parser.add_argument("timeline", type=Path, nargs="?", default=None,
                        help="Path to timeline.beat-locked.json (auto-discovered if omitted)")
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()

    timeline_path: Path = args.timeline if args.timeline is not None else find_beat_locked_timeline()
    if not timeline_path.exists():
        print(f"render: file not found: {timeline_path}", file=sys.stderr)
        sys.exit(1)

    timeline = json.loads(timeline_path.read_text(encoding="utf-8"))
    base_dir = timeline_path.parent
    out = args.out or base_dir / "recap.mp4"
    resolution = tuple(timeline.get("render", {}).get("resolution", [1920, 1080]))
    music_path = timeline.get("music", {}).get("path")

    with tempfile.TemporaryDirectory() as tmp:
      tmp_path = Path(tmp)
      concat_file = tmp_path / "concat.txt"
      lines = []
      clip_index = 0
      for day in timeline.get("days", []):
          for item in day.get("media", []):
              clip = tmp_path / f"clip-{clip_index:05d}.mp4"
              render_clip(item, base_dir, clip, resolution)
              lines.append(f"file '{clip}'\n")
              clip_index += 1
      concat_file.write_text("".join(lines), encoding="utf-8")
      silent = tmp_path / "silent.mp4"
      run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file), "-c", "copy", str(silent)])
      if music_path:
          run([
              "ffmpeg",
              "-y",
              "-i",
              str(silent),
              "-i",
              str(Path(music_path).expanduser()),
              "-shortest",
              "-c:v",
              "copy",
              "-c:a",
              "aac",
              str(out),
          ])
      else:
          out.write_bytes(silent.read_bytes())
    print(f"render: wrote {out}")


if __name__ == "__main__":
    main()
