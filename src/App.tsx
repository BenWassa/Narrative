import React from 'react';
import PhotoOrganizer from './features/photo-organizer/PhotoOrganizer';

/**
 * Top-level application component
 *
 * This is the main UI composition layer that orchestrates the app's screens.
 * Currently renders PhotoOrganizer as the primary interface.
 *
 * Future enhancements may include:
 * - React Router for multi-page navigation
 * - Global providers (theme, auth, etc.)
 * - Layout wrappers (header, footer, etc.)
 *
 * @see docs/FRONTEND_ARCHITECTURE.md for architecture details
 */
function App() {
  return <PhotoOrganizer />;
}

export default App;
