#!/usr/bin/env python3
"""Beat-lock a Narrative video timeline.

This CLI implements the v1 JSON contract in PIPELINE.md. It prefers librosa for
beat detection and OpenCV for motion-window selection, but keeps a deterministic
fallback so the pipeline can still be exercised before optional media
dependencies are installed.
"""

from __future__ import annotations

import argparse
import copy
import json
import math
from pathlib import Path
from typing import Any


DEFAULT_BPM = 120.0
PHOTO_BEATS_BY_BUCKET = {
    "A": 4,
    "B": 4,
    "C": 3,
    "D": 4,
    "E": 2,
    "M": 3,
}


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def detect_beats(song_path: Path, target_duration: float) -> tuple[float, list[float]]:
    try:
        import librosa  # type: ignore

        y, sr = librosa.load(str(song_path), mono=True)
        tempo, frames = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(tempo[0] if isinstance(tempo, (list, tuple)) else tempo)
        beats = [round(float(t), 3) for t in librosa.frames_to_time(frames, sr=sr)]
        if beats:
            return bpm, beats
    except Exception as exc:
        print(f"beat-sync: librosa unavailable or failed ({exc}); using {DEFAULT_BPM} BPM fallback")

    beat_len = 60.0 / DEFAULT_BPM
    total_beats = max(1, math.floor(target_duration / beat_len))
    return DEFAULT_BPM, [round(i * beat_len, 3) for i in range(total_beats + 1)]


def snap_duration(seconds: float, beat_len: float, min_beats: int = 2) -> float:
    beats = max(min_beats, round(seconds / beat_len))
    return round(beats * beat_len, 3)


def motion_window(path: Path, window_duration: float) -> list[float] | None:
    try:
        import cv2  # type: ignore

        cap = cv2.VideoCapture(str(path))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
        duration = frame_count / fps if fps else 0
        if duration <= window_duration:
            cap.release()
            return [0, round(duration, 3)]

        sample_step = max(1, int(fps // 2))
        scores: list[tuple[float, float]] = []
        prev = None
        idx = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if idx % sample_step == 0:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                if prev is not None:
                    score = float(cv2.absdiff(gray, prev).mean())
                    scores.append((idx / fps, score))
                prev = gray
            idx += 1
        cap.release()

        if not scores:
            return [0, round(window_duration, 3)]

        best_start = 0.0
        best_score = -1.0
        for start, _ in scores:
            end = start + window_duration
            score = sum(value for ts, value in scores if start <= ts <= end)
            if score > best_score:
                best_score = score
                best_start = start
        best_start = max(0.0, min(best_start, duration - window_duration))
        return [round(best_start, 3), round(best_start + window_duration, 3)]
    except Exception:
        return None


def iter_media(timeline: dict[str, Any]):
    for day in timeline.get("days", []):
        for item in day.get("media", []):
            yield item


def beat_lock(
    timeline: dict[str, Any], timeline_dir: Path, song_path: Path, target: float
) -> dict[str, Any]:
    result = copy.deepcopy(timeline)
    result.setdefault("music", {})["path"] = str(song_path)
    result["music"]["target_duration_sec"] = target

    bpm, beats = detect_beats(song_path, target)
    beat_len = 60.0 / bpm if bpm else 60.0 / DEFAULT_BPM
    media_items = list(iter_media(result))
    raw_durations: list[float] = []

    for item in media_items:
        if item.get("kind") == "video":
            source_duration = float(item.get("duration_sec") or 4 * beat_len)
            raw_durations.append(snap_duration(min(source_duration, 8 * beat_len), beat_len, 2))
        else:
            bucket = item.get("bucket")
            raw_durations.append(PHOTO_BEATS_BY_BUCKET.get(bucket, 4) * beat_len)

    total = sum(raw_durations) or 1
    scale = target / total
    cursor = 0.0

    for item, duration in zip(media_items, raw_durations):
        snapped = snap_duration(duration * scale, beat_len, 2)
        item["start_sec"] = round(cursor, 3)
        item["duration_sec"] = snapped
        item["section"] = "main"
        if item.get("kind") == "video":
            if item.get("best_segment_sec"):
                item["in_out_sec"] = item["best_segment_sec"]
            else:
                item["in_out_sec"] = motion_window(timeline_dir / item["path"], snapped) or [0, snapped]
        else:
            item["in_out_sec"] = None
        cursor += snapped

    result["audio"] = {
        "beats_sec": beats,
        "sections": [{"name": "main", "start_sec": 0, "end_sec": round(cursor, 3)}],
        "bpm": round(bpm, 3),
    }
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Beat-lock a Narrative timeline.json")
    parser.add_argument("timeline", type=Path)
    parser.add_argument("--song", required=True, type=Path)
    parser.add_argument("--target", type=float)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()

    timeline = load_json(args.timeline)
    target = args.target or float(timeline.get("music", {}).get("target_duration_sec") or 360)
    result = beat_lock(timeline, args.timeline.parent, args.song.expanduser(), target)
    out = args.out or args.timeline.with_name("timeline.beat-locked.json")
    with out.open("w", encoding="utf-8") as handle:
        json.dump(result, handle, indent=2)
        handle.write("\n")
    print(f"beat-sync: wrote {out}")


if __name__ == "__main__":
    main()
