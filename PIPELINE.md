# Pipeline: Narrative → Video

> Status: draft v1 · Owner: Ben · Date: 2026-05-15
> This is the contract between the layers of the trip-video pipeline. When the layers disagree, this document is the tiebreaker. Update it before changing a layer's interface, not after.

## 1. Goal

Turn a curated trip folder into a **3–8 minute long-form recap video** in one evening instead of weeks. Output is a draft MP4 that imports into CapCut for final polish.

Success = elapsed time from curated photos to publishable draft drops from weeks to hours, with the same template reusable across trips.

## 2. End-to-end flow

```
[Trip folder]
     │
     ▼
┌────────────────────┐
│ Layer 1: Narrative │  curate · bucket · order · day-notes
│    (existing app)  │  emits: timeline.json
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Layer 2: beat-sync │  read timeline.json + song.mp3
│    (Python CLI)    │  detect beats · snap durations · pick best
│                    │  segment per B-roll clip
│                    │  emits: timeline.beat-locked.json
└─────────┬──────────┘
          │
          ▼   (human eyeballs JSON, tweaks if needed)
          │
┌────────────────────┐
│ Layer 3: render    │  v1.0 ffmpeg renderer reads JSON
│    (ffmpeg first)  │  basic scale/crop/cut · burns music
│                    │  v1.1 HyperFrames adds Ken Burns · day cards ·
│                    │  captions · fade transitions
│                    │  emits: recap.mp4
└─────────┬──────────┘
          │
          ▼
[CapCut] → final color + audio polish → ship
```

Single human approval gate: between Layer 2 and Layer 3. The JSON is small enough to read.

## 3. The JSON contract (load-bearing)

This is the only thing the layers share. Get this right and each layer is independently swappable.

### `timeline.json` (emitted by Narrative)

```jsonc
{
  "schema": 1,
  "trip": {
    "id": "japan-2026-spring",
    "title": "Japan, Spring 2026",
    "date_range": ["2026-03-12", "2026-03-26"]
  },
  "music": {
    "path": "songs/track.mp3", // user-selected, lives outside the trip folder
    "target_duration_sec": 360 // soft target; beat-sync will snap to nearest section/musical boundary
  },
  "days": [
    {
      "day_number": 1,
      "date": "2026-03-12",
      "title": "Arrival in Tokyo", // shown on day card
      "notes": "Jet-lagged ramen run.", // shown as lower-third or subtitle (optional)
      "media": [
        {
          "kind": "photo",
          "path": "01_DAYS/Day 1/IMG_0234.jpg",
          "bucket": "landscape", // existing MECE bucket
          "order": 0, // Narrative's existing ordering
          "caption": null // optional override; falls back to day.notes
        },
        {
          "kind": "video",
          "path": "01_DAYS/Day 1/CLIP_0012.mp4",
          "bucket": "people",
          "order": 1,
          "duration_sec": 14.2, // source duration, for trimming hints
          "best_segment_sec": null // null = let beat-sync pick; or [start, end] to lock it
        }
      ]
    }
  ],
  "render": {
    "aspect": "16:9", // or "9:16" — fixed per render
    "resolution": [1920, 1080],
    "template": "recap-v1" // names a HyperFrames composition
  }
}
```

### `timeline.beat-locked.json` (emitted by beat-sync, consumed by render)

Same shape, with three things added per `media` item and one block added at the top level:

```jsonc
{
  // ...everything from timeline.json...
  "audio": {
    "beats_sec": [0.50, 1.00, 1.50, ...],       // absolute timestamps
    "sections": [                                // v1 always one section "main"; v2 will populate
      { "name": "main", "start_sec": 0, "end_sec": 360 }
    ],
    "bpm": 120
  },
  "days": [{
    "media": [{
      // ...all original fields...
      "start_sec": 12.0,           // when this item appears in the final video
      "duration_sec": 2.0,         // beat-snapped (e.g. 4 beats at 120 BPM)
      "section": "main",           // v2: "intro" | "build" | "drop" | "outro"
      "in_out_sec": [3.1, 5.1]     // for video clips, sub-trim of the source file (null for photos)
    }]
  }]
}
```

**Why the v2 fields exist in v1:** the `section` field and the `sections` array are populated trivially (everything is `"main"`) in v1. Adding section-aware editing in v2 means a smarter beat-sync; **the renderer doesn't change**. This is the load-bearing design decision.

### `recap.mp4` (emitted by render)

Single MP4, draft quality. No project file, no XML. CapCut imports MP4s natively.

### Path base

`timeline.json` is written to the Narrative project root. Every `media.path` is relative to that same project root, and export refuses to write the timeline if any active assigned media path does not resolve under that root.

## 4. Scope per layer

### Layer 1: Narrative (extend existing app)

**In scope:**

- Recognize `.mp4` / `.mov` clips alongside photos in trip folders
- Show video clips in the existing grid with a thumbnail (first frame) and a duration badge
- Bucket video clips into the existing MECE buckets — clips are _additional photos_, not a new entity
- Per-day `notes` field (new, short free-text input on the day header)
- Per-day `title` field (new; defaults to `Day N`)
- New export action: "Export video timeline" → writes `timeline.json` to the project root
- Refuse timeline export when active media is missing a day assignment or when any media path cannot be resolved under the project root
- Trip-level title + date range come from existing project metadata

**Out of scope (v1):**

- Inline video preview / scrubbing — thumbnail only is enough for curation
- Per-clip caption editing — falls back to day.notes
- Picking the music track inside Narrative — Layer 2 takes `--song path.mp3` as a CLI arg

**Touches in the graph:** `MECE_BUCKETS` (extend), `folderDetectionService` (extend), `buildOperationPlan` / `exportManifest` (sibling artifact, not a rewrite), `PhotoOrganizer` (new toolbar action).

### Layer 2: beat-sync (new Python CLI)

**In scope:**

- Read `timeline.json` + a song file path
- Detect beats with `librosa` (BPM + beat-time array)
- Compute a duration target per media item: photos get N beats by bucket-default policy, video clips get max(min_beats, snapped_to_clip_length) beats
- For video clips with `best_segment_sec: null`, run motion-energy detection (OpenCV) and pick the most dynamic window
- Distribute durations so total fits the song length
- Emit `timeline.beat-locked.json`

**Out of scope (v1):**

- Section-aware editing — populate `section: "main"` everywhere, leave the door open
- Audio-reactive animations — render layer concern
- Voice-over / narration

**Tools:** Python 3, `librosa`, `opencv-python`, `ffmpeg-python`. No GUI — pure CLI. Lives in a new top-level folder, e.g. `tools/beat-sync/`.

### Layer 3: render (ffmpeg v1.0, HyperFrames v1.1)

**In scope:**

- One composition template called `recap-v1`, parameterized by `timeline.beat-locked.json`
- Day cards (title + date)
- Ken Burns pans on photos (auto direction based on aspect)
- Cut-on-beat for video clips, trimmed to `in_out_sec`
- Lower-thirds for day.notes
- Trip intro card (trip.title + date_range) and outro card
- Music bed (the song from `audio.path`)
- Crossfades between days (longer); cuts within a day

**Out of scope (v1):**

- Color grading per clip — assume clips are pre-graded or share one LUT applied upstream
- Talking-head / transcript cuts
- TTS narration
- Picture-in-picture, multi-track overlays
- Transitions fancier than fade and cut

**Tools:** v1.0 ships a basic ffmpeg renderer in `tools/render/recap-v1/` so the JSON contract can be validated end to end. HyperFrames + GSAP are the v1.1 upgrade path for Ken Burns, day cards, lower-thirds, and crossfades.

## 5. Non-goals (v1)

Saying "not yet" is a feature. v1 explicitly does **not** do:

1. **Talking-head / transcript-driven cuts.** No on-camera narration support. Add in v2 if needed.
2. **Color grading inside the pipeline.** Pre-grade in CapCut or apply a LUT upstream of the pipeline.
3. **Voice-over / TTS narration.** Music only.
4. **Multi-track / overlays.** Single timeline. No PiP, no overlay clips.
5. **Final-cut quality.** The output is a _draft_ that imports into CapCut for polish.
6. **Music selection UI.** Song path is a CLI arg, not a Narrative feature.

## 6. Example trip (Japan, 2026 spring, 14 days)

The honest sanity check. Walk one trip through every layer.

1. **Curate in Narrative** (existing flow, ~1 hour for ~2000 photos)
   Project already grouped by day. Add: 32 video clips totalling 11 minutes of raw footage land in the grid alongside photos. User assigns buckets, archives weak shots.

2. **Day notes** (~10 min)
   For each of 14 days, type a 5–10 word note. e.g. Day 1 = `"Arrival in Tokyo"`, Day 7 = `"Snow at Koyasan."`.

3. **Export timeline** (~1 second)
   Click "Export video timeline". `timeline.json` appears in the Narrative project root. ~14 days × ~30 media each = ~420 entries.

4. **Pick a song** (~5 min)
   User chooses a 6-minute track from their music library.

5. **Run beat-sync** (~30 seconds)
   `tools/beat-sync/run.py timeline.json --song ~/Music/track.mp3 --target 360`
   Outputs `timeline.beat-locked.json`. Total duration: 358s (snapped to nearest section end).

6. **Eyeball the JSON** (~5 min)
   User scans durations and `in_out_sec` for clips. Notices Day 7's snow clip got 2 beats — adjusts to 8 by editing JSON.

7. **Render** (~10 min on a laptop)
   `python tools/render/recap-v1/render_ffmpeg.py timeline.beat-locked.json --out recap.mp4`
   MP4 lands at 1920×1080, 358 seconds.

8. **Polish in CapCut** (~30 min)
   Import MP4. Apply a LUT. Tweak audio levels. Add closing graphic. Export final.

**Total elapsed time:** ~2 hours active work for what used to take weeks.

## 7. Open questions for execution

These don't block writing the PRD; they need a decision before implementing each layer.

- **Layer 1:** Where does the "Export video timeline" button live in the UI? Sidebar action or toolbar?
- **Layer 1:** Should video clips occupy one grid tile each, or a "clip strip" row separate from photos?
- **Layer 2:** Default beats-per-photo policy — fixed (e.g. 4 beats), bucket-dependent, or learned from duration target?
- **Layer 2:** What happens if `target_duration_sec` and beat-snapped total disagree by more than ~5 seconds? Trim, pad, or warn?
- **Layer 3:** Day card style — full-screen card or lower-third overlay over the next photo?
- **Layer 3:** Default Ken Burns direction algorithm — random, photo-orientation-based, or content-aware?

Decide these per layer as we plan that layer, not now.
