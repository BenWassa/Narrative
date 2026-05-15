# recap-v1

HyperFrames composition target for `timeline.beat-locked.json`.

The template contract is intentionally JSON-only. `composition.js` exports helpers
for a HyperFrames/GSAP renderer, and `render_ffmpeg.py` is a pragmatic v1 draft
renderer that turns the same beat-locked JSON into `recap.mp4` with ffmpeg.

```bash
python tools/render/recap-v1/render_ffmpeg.py timeline.beat-locked.json --out recap.mp4
```
