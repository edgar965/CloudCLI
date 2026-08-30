import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import 'katex/dist/katex.min.css'

// Initialize i18n
import './i18n/config.js'

// Accept a login handed over in the address: `?token=<jwt>`.
//
// A desktop window runs with its own Electron profile (the single-instance
// lock is keyed on `--user-data-dir`), so a newly created profile starts with
// an empty localStorage and would ask for a login even though the machine is
// already logged in. The launcher passes the token this way, before React
// mounts and reads the store. It is removed from the address right after, so
// it does not linger in history or in a shared link.
try {
  const startUrl = new URL(window.location.href);
  const handoverToken = startUrl.searchParams.get('token');
  if (handoverToken) {
    localStorage.setItem('auth-token', handoverToken);
    startUrl.searchParams.delete('token');
    window.history.replaceState({}, '', `${startUrl.pathname}${startUrl.search}${startUrl.hash}`);
  }
} catch (error) {
  console.warn('Could not read the token from the address:', error);
}

// Register service worker for PWA + Web Push support
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(err => {
    console.warn('Service worker registration failed:', err);
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
