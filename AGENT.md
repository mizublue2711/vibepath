# AGENTS.md — Technical Architecture & AI Worker Execution Guidelines

> **Project Repository**: `https://github.com/mizublue2711/vibepath`  
> **Project Name**: VibePath (Automated 3D Cinematic Map & AI Script Generator for Food Vloggers)  
> **Target Platform**: Vite + React + TypeScript + WebGL (Mapbox GL JS v3) + Cloudflare Workers

---

## 1. Directory Tree & File Inventory

All AI Workers (Jules, Cursor, Claude Code, Copilot) MUST strictly adhere to this folder structure and refer to files by their exact relative paths.


vibepath/
├── .env.example                     # Sample environment variables configuration
├── .gitignore                       # Git ignore rules
├── index.html                       # HTML entry point with font imports
├── package.json                     # Node.js dependencies & build scripts
├── tsconfig.json                    # TypeScript compiler configuration
├── vite.config.ts                   # Vite bundler configuration
├── wrangler.toml                    # Cloudflare Workers / Pages deployment config
│
├── functions/                       # Cloudflare Workers Serverless API Endpoints
│   └── api/
│       └── poi-search.ts            # Backend Proxy endpoint for Mapbox & OSM search
│
├── src/                             # Main Frontend Application Source Code
│   ├── main.tsx                     # Application entry point (imports Mapbox CSS & React root)
│   ├── App.tsx                      # Main layout container & view switcher
│   ├── index.css                    # Global CSS, Tailwind setup & Cybernetic Swiss Brutalism rules
│   ├── vite-env.d.ts                # Vite environment types declarations
│   │
│   ├── components/                  # React UI Components
│   │   ├── CyberGlobe3D.tsx         # WebGL 3D Globe, Terrain DEM, Extrusions, Atmosphere & Path rendering
│   │   ├── PoiSearchBox.tsx         # POI Search Bar with Mapbox Search Box v6 & OSM fallback
│   │   ├── Navigation.tsx           # Top HUD Header, Telemetry readout & Glowing Render Button
│   │   ├── SettingsModal.tsx        # BYOK (Bring Your Own Key) configuration modal
│   │   ├── DistrictBoundaryOverlay.tsx # Administrative district boundary polygon highlight
│   │   ├── EditorStudio/            # Editor NLE Asset Workspace Sub-components
│   │   │   ├── StudioLayout.tsx     # Editor Studio main container & panel splitter
│   │   │   ├── VideoPreview.tsx     # 3D Rendered Video player & canvas preview
│   │   │   ├── ScriptPanel.tsx      # Voiceover script viewer & subtitle SRT exporter
│   │   │   └── AssetExporter.tsx    # 1-Click ZIP/XML timeline asset download panel
│   │   └── UI/                      # Base Reusable Cybernetic Components
│   │       ├── BrutalistButton.tsx  # Zero-radius sharp button with cyan glow
│   │       ├── BrutalistCard.tsx    # Panel container with 1px dark border
│   │       └── TelemetryBadge.tsx   # HUD status indicator badge
│   │
│   ├── services/                    # Business Logic & External API Services
│   │   ├── cinematicFlightEngine.ts # 4-Stage Async Camera Flight sequence controller
│   │   ├── videoRecorder.ts         # WebGL Canvas 60FPS High-Bitrate MediaRecorder engine
│   │   ├── globalBoundaryService.ts # Mapbox vector tileset district boundary query service
│   │   ├── apiKeyManager.ts         # BYOK LocalStorage manager & event dispatcher
│   │   ├── osmFallbackService.ts    # OpenStreetMap Nominatim fallback search service
│   │   └── syncCloudService.ts      # Cloudflare / n8n Webhook Cloud Sync payload formatter
│   │
│   ├── context/                     # React Context Providers
│   │   ├── ThemeContext.tsx         # Branding colors, fonts, and UI style context
│   │   └── FlightStateContext.tsx   # Camera flight stage, active POI & telemetry state
│   │
│   ├── types/                       # TypeScript Type Definitions
│   │   ├── map.ts                   # Search result, POI, coordinate & boundary types
│   │   ├── flight.ts                # Flight stage enum, camera parameters & telemetry interfaces
│   │   └── asset.ts                 # SRT subtitle, XML marker & export asset types
│   │
│   └── utils/                       # Utility Functions
│       ├── bsplineSmooth.ts         # B-Spline GPS coordinate path smoothing algorithm
│       └── formatters.ts            # Telemetry text, time & coordinate formatting helpers
│
└── public/                          # Static Assets & Icons
    ├── favicon.ico                  # App favicon
    └── logo.svg                     # VibePath Cyberpunk logo
_________________________________________________

2. Core Modules & Component Responsibilities
File Path
Primary Responsibility
Critical Rules & Dependencies
src/components/CyberGlobe3D.tsx
WebGL 3D Globe Initialization, Terrain DEM (1.6x), 3D Building Extrusions, Atmospheric Shader, Radar Laser Column at POI.
MUST initialize Mapbox with preserveDrawingBuffer: true. MUST handle container map.resize() via ResizeObserver.
src/services/cinematicFlightEngine.ts
4-Stage Camera Flight Sequence: Stage 1 (Space Orbit + 3s spin) → Stage 2 (Descent) → Stage 3 (District Focus) → Stage 4 (3D Street Flyover).
Uses easeInOutCubic easing. Flight duration: ~12.5 seconds total.
src/services/videoRecorder.ts
Captures WebGL canvas stream at 60FPS. Triggers auto-download .webm / .mp4.
Sets videoBitsPerSecond: 20000000 (20 Mbps) to avoid blurry HUD text.
src/components/PoiSearchBox.tsx
Free-text search bar for restaurants/food venues & geographic regions.
Mapbox Search Box v6 primary + OpenStreetMap Nominatim fallback when Mapbox returns 0 results.
src/services/globalBoundaryService.ts
Administrative District Boundary Highlight (mapbox://mapbox.boundaries-adm2-v4).
Sets dynamic layer filter to outline organic city/district borders in #00E5FF dashed stroke during Stage 3.
src/components/Navigation.tsx
Top HUD Header containing status indicators and [ 🎬 1-CLICK CINEMATIC RENDER ] action button.
Styled with subtle glowing Electric Cyan border (box-shadow: 0 0 12px rgba(0, 229, 255, 0.35)).
src/services/apiKeyManager.ts
Manages BYOK (Bring Your Own Key) in localStorage.
Dispatches vibepath_apikeys_updated custom event on save.
functions/api/poi-search.ts
Cloudflare Worker Serverless Proxy Endpoint for backend search.
Holds SYSTEM_MAPBOX_TOKEN server-side to conceal keys from frontend client.

_________________________________________________

3. UI/UX Design System: Cybernetic Swiss Brutalism
When modifying or creating any React UI components, AI Workers MUST follow these visual guidelines:
Zero Border Radius Rule (Mandatory):
Enforce border-radius: 0px !important on ALL elements (buttons, search inputs, modal cards, dropdowns, badges). No rounded corners allowed anywhere.
Color Palette:
Primary Accent: #00E5FF (Electric Cyan)
Secondary Accent: #5322FF (Quantum Violet)
Status Accent: #00FF66 (Satellite Green)
Background: #080A0F (Terminal Black) / #0D1017 (Panel Slate)
Borders: 1px solid #1F1F2E (Subtle) / 1px solid #00E5FF (Active)
Typography:
Font Family: 'JetBrains Mono', 'Space Grotesk', monospace for all telemetry readouts, status codes, and coordinate readouts.
Bracket Enclosures:
Wrap UI labels and status codes in bracket notation: [ 🟢 GPS_LOCKED • ±1.2m ], [ 01 // POI ], [ 🎬 1-CLICK CINEMATIC RENDER ].
_________________________________________________

4. Developer Workflows & Safety Rules for AI Workers
A. Environment Variables & Vite Build Rule
Public API keys use the VITE_ prefix: import.meta.env.VITE_MAPBOX_TOKEN.
CRITICAL: Vite bakes import.meta.env variables into static JS at build time. When updating environment secrets on Cloudflare Dashboard, a re-deployment / retry build MUST be triggered for changes to take effect.
B. Mapbox WebGL Canvas Protection
Never remove preserveDrawingBuffer: true from mapboxgl.Map initialization in CyberGlobe3D.tsx. Removing it causes the video recorder to capture black/blank screens.
Always include ResizeObserver on mapContainer element to prevent map canvas clipping issues.
C. Search Resilience & Dual-Engine Fallback
PoiSearchBox.tsx MUST first attempt Mapbox Search Box API v6 with proximity bias.
If Mapbox returns 0 results for Vietnamese food venues (e.g., "BÁNH CUỐN BÀ HOÀNH"), automatically fall back to OpenStreetMap Nominatim API (countrycodes=vn).
D. Cloud Sync Payload Contract
When triggering syncCloudService.ts, always attach the full payload including branding, flight_telemetry, poi_coordinates, and voiceover_language.
_________________________________________________

5. Definition of Done (DoD) Checklist for Code Modifications
Before committing code, AI Workers MUST verify:
[ ] Code builds cleanly with npm run build with zero TypeScript or Vite errors.
[ ] No border-radius values greater than 0px exist in new CSS/Tailwind classes.
[ ] CyberGlobe3D.tsx maintains canvas sizing across window resizes via map.resize().
[ ] Search functionality returns valid coordinates for both global landmarks and local Vietnamese food stalls.
[ ] All file modifications update the exact paths specified in Section 1 of this document.
