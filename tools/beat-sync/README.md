# beat-sync

Beat-locks a Narrative `timeline.json` into `timeline.beat-locked.json`.

```bash
python tools/beat-sync/run.py tools/beat-sync/fixtures/sample-timeline.json --song /path/to/song.mp3 --target 60
```

Install optional media analysis dependencies with:

```bash
python -m pip install -r tools/beat-sync/requirements.txt
```

Without those dependencies, the CLI still emits deterministic beat timing at 120 BPM and default video trims.
