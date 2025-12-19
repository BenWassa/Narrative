import React from 'react';
import { createRoot } from 'react-dom/client';
import PhotoOrganizer from './PhotoOrganizer';
import '../styles/tailwind.css';

// Minimal entry; assumes a bundler / dev server will provide an element with id 'root'.
export default PhotoOrganizer;

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <PhotoOrganizer />
    </React.StrictMode>
  );
}
