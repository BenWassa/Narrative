import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tailwind.css';

function shouldCleanupServiceWorkerScope(scope: string): boolean {
  try {
    const scopeUrl = new URL(scope);
    if (scopeUrl.origin !== window.location.origin) return false;

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return true;
    }

    return scopeUrl.pathname.startsWith('/Narrative/');
  } catch {
    return false;
  }
}

async function cleanupStaleServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const targets = registrations.filter(registration =>
      shouldCleanupServiceWorkerScope(registration.scope),
    );
    if (targets.length === 0) return;

    const results = await Promise.all(targets.map(registration => registration.unregister()));
    const unregisteredCount = results.filter(Boolean).length;
    console.info(`[bootstrap] Unregistered ${unregisteredCount} stale service worker(s).`);
  } catch (error) {
    console.warn('[bootstrap] Failed to cleanup stale service workers.', error);
  }
}

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

void cleanupStaleServiceWorkers();

createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
