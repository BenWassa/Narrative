import React from 'react';
import { createRoot } from 'react-dom/client';
import PhotoOrganizer from './PhotoOrganizer';

// Minimal entry; assumes a bundler / dev server will provide an element with id 'root'.
const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <PhotoOrganizer />
    </React.StrictMode>
  );
} else {
  // For tests / SSR-like scenarios, export the component
  // so it can be mounted by the environment.
  // eslint-disable-next-line import/no-default-export
  export default PhotoOrganizer;
}
