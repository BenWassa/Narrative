Archived backend

Status:
- The backend API (filesystem operations) is no longer required for the current viewer-only flow.
- Local files are now indexed directly in the frontend using the directory picker and persisted handles.

Why archived:
- The product direction moved to a client-only experience without filesystem edits.
- Browser security constraints made absolute paths unreliable; handles provide enough access for reading.

Notes:
- The backend code is preserved here for future reference or a possible native/agent-based version.
