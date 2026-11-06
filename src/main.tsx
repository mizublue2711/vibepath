import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'mapbox-gl/dist/mapbox-gl.css';
import App from './App.tsx';
import './index.css';

// Graceful Google Maps API Error & Fallback Handling (prevents ApiProjectMapError from crashing runtime)
(window as any).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-map-fallback', { detail: 'gm_authFailure' }));
};

const origError = console.error;
console.error = (...args: unknown[]) => {
  const msg = args.map((a) => String(a)).join(' ');
  if (
    msg.includes('ApiProjectMapError') ||
    msg.includes('RefererNotAllowedMapError') ||
    msg.includes('InvalidKeyMapError') ||
    msg.includes('MissingKeyMapError') ||
    msg.includes('NoApiKeys') ||
    msg.includes('BillingNotEnabledMapError')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-map-fallback', { detail: msg }));
    console.warn('[VibePath Map Engine] Switching to native 60FPS 3D Kinetic Telemetry Terrain canvas.');
    return;
  }
  origError.apply(console, args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
