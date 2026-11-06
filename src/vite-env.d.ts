/// <reference types="vite/client" />
import type * as React from 'react';

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'gmp-map-3d': any;
      'gmp-marker': any;
    }
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'gmp-map-3d': any;
      'gmp-marker': any;
    }
  }
}


