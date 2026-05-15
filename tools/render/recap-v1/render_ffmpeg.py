#!/usr/bin/env python3
"""Draft ffmpeg renderer for Narrative beat-locked timelines.

This is deliberately plain: it creates a concat list using photos as looping
video inputs and trims video clips with the `in_out_sec` values from beat-sync.
HyperFrames can consume the same timeline through composition.js when available.
"""

from __future__ import annotations

import argparse
import json
import subprocess
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Render a draft recap MP4 from timeline.beat-locked.json")
    parser.add_argument("timeline", type=Path)
    parser.add_argument("--out", type=Path, default=Path("recap.mp4"))
    args = parser.parse_args()

    timeline = json.loads(args.timeline.read_text(encoding="utf-8"))
    base_dir = args.timeline.parent
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
              str(args.out),
          ])
      else:
          args.out.write_bytes(silent.read_bytes())
    print(f"render: wrote {args.out}")


if __name__ == "__main__":
    main()
