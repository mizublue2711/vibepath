import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'mapbox-gl/dist/mapbox-gl.css';
import App from './App.tsx';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

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
    return;
  }
  origError.apply(console, args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);
