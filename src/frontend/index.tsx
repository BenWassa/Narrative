import React from 'react';
import { createRoot } from 'react-dom/client';
import PhotoOrganizer from './PhotoOrganizer';
import '../styles/tailwind.css';

// Minimal entry; assumes a bundler / dev server will provide an element with id 'root'.
// Note: we do not export the component from this entry file (it's not used elsewhere)

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <PhotoOrganizer />
    </React.StrictMode>,
  );
}
