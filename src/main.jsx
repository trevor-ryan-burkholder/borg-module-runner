import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/theme.css';
import './styles/components.css';

// Apply theme variant body classes BEFORE first paint so high-contrast /
// large-text don't flash off for one frame. Reads the same `mb-theme` key
// App.jsx writes, so the two stay in sync.
(() => {
  try {
    const raw = localStorage.getItem('mb-theme');
    if (!raw) return;
    const t = JSON.parse(raw);
    if (t?.highContrast) document.body.classList.add('theme-high-contrast');
    if (t?.largeText) document.body.classList.add('theme-large-text');
  } catch { /* corrupted theme JSON — fall back to defaults */ }
})();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Service worker registration. Same-origin only; ignored on file://.
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    const swUrl = new URL('sw.js', document.baseURI).toString();
    navigator.serviceWorker.register(swUrl).catch(() => {
      // Registration can legitimately fail (private mode, etc.). App still works online.
    });
  });
}
