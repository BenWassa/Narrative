import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tailwind.css';

/**
 * Application entry point
 *
 * This file bootstraps the React application by:
 * 1. Finding the root DOM element (from index.html)
 * 2. Creating a React root
 * 3. Rendering the App component wrapped in StrictMode
 * 4. Loading global styles (Tailwind CSS)
 *
 * React StrictMode helps identify potential problems by:
 * - Detecting unexpected side effects
 * - Warning about deprecated APIs
 * - Running effects twice in development (to catch bugs)
 *
 * @see https://react.dev/reference/react/StrictMode
 * @see docs/FRONTEND_ARCHITECTURE.md for architecture details
 */
const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element not found. Make sure index.html contains a div with id="root"');
}

createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
