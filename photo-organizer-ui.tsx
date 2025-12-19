/*
  Deprecated wrapper file
  The component implementation was moved to `src/frontend/PhotoOrganizer.tsx`.
  Keep this file as a thin shim for backward compatibility during transition.
  Remove this file once callers are migrated to the new path.
*/

import PhotoOrganizer from './src/frontend/PhotoOrganizer';

// warn when imported directly
if (typeof console !== 'undefined' && console.warn) {
  console.warn('`photo-organizer-ui.tsx` is deprecated — use `src/frontend/PhotoOrganizer.tsx` instead.');
}

export default PhotoOrganizer;