# AGENTS.md — Technical Architecture & AI Worker Execution Guidelines

> **Project Repository**: `https://github.com/mizublue2711/vibepath`  
> **Project Name**: VibePath (Automated 3D Cinematic Map & AI Script Generator for Food Vloggers)  
> **Production Live Domain**: `https://vibepath.artificialcraft.space/`  
> **Target Platform**: Vite + React + TypeScript + WebGL (Mapbox GL JS v3) + Cloudflare Workers / Pages

---

## 1. Directory Tree & System Lineage

All AI Workers (Jules, Cursor, Claude Code, Copilot) MUST strictly adhere to this directory structure and refer to files by their exact relative paths.

```text
vibepath/
├── wrangler.toml                    # Cloudflare Workers / Pages deployment config (MUST include [previews])
├── package.json                     # Node.js dependencies & build scripts
├── tsconfig.json                    # TypeScript compiler configuration
├── vite.config.ts                   # Vite bundler configuration
│
├── src/                             # Main Frontend Application Source Code
│   ├── main.tsx                     # Application entry point (Mapbox CSS & React root)
│   ├── App.tsx                      # Main layout container & active view switcher
│   ├── index.css                    # Global CSS & Cybernetic Swiss Brutalism rules
│   │
│   ├── components/                  # React UI Components
│   │   ├── CyberGlobe3D.tsx         # WebGL 3D Globe, Terrain DEM, Extrusions & Path rendering
│   │   ├── TargetPinningTerminal.tsx # Culinary spot pinning & taste notes terminal
│   │   ├── PoiSearchBox.tsx         # POI Search Bar with Mapbox & OSM fallback
│   │   ├── Navigation.tsx           # Top HUD Header & Status indicators
│   │   ├── OnboardingModal.tsx      # First-visit 3-step Quick Start Guide modal
│   │   └── UI/                      # Base Reusable Cybernetic Components
│   │       ├── BrutalistButton.tsx  # Zero-radius sharp button with cyan glow
│   │       ├── BrutalistCard.tsx    # Panel container with 1px dark border
│   │       └── TelemetryBadge.tsx   # HUD status indicator badge
│   │
│   ├── context/                     # React Context Providers
│   │   ├── ThemeContext.tsx         # Branding colors, fonts, and UI style context
│   │   └── FlightStateContext.tsx   # Camera flight stage, active POIs & localStorage sync
│   │
│   ├── locales/                     # i18n Dictionaries (1:1 Key Parity Mandatory)
│   │   ├── en.ts                    # English strings
│   │   └── vi.ts                    # Vietnamese strings
│   │
│   ├── services/                    # Business Logic & External API Services
│   │   ├── cinematicFlightEngine.ts # 4-Stage Async Camera Flight sequence controller
│   │   ├── videoRecorder.ts         # WebGL Canvas 60FPS MediaRecorder engine
│   │   └── syncCloudService.ts      # Cloudflare / n8n Webhook Cloud Sync formatter
│   │
│   └── types/                       # TypeScript Type Definitions
│       ├── map.ts                   # Search result, POI & coordinate types
│       └── flight.ts                # Flight stage enum & camera parameters
│
└── scripts/                         # Verification & Validation Scripts
    ├── test-i18n.ts                 # 1:1 key parity checker
    └── verify-live.ts               # Headless Playwright live production/preview verifier
```

2. Component Lineage & Multi-File Wiring Contract
To prevent "stale code / invisible updates" on production:
Atomic Multi-File Commits:
Modifying a sub-component (e.g., TargetPinningTerminal.tsx) REQUIRES updating its parent layout in src/App.tsx and state provider in src/context/FlightStateContext.tsx within the SAME COMMIT.
Context State Hydration:
FlightStateContext.tsx MUST manage pinnedLocations state and automatically sync with localStorage.setItem('vibepath_pinned_session', ...) upon updates.
Decoupled Camera Engine:
Selecting/pinning POIs during live editing MUST use low-altitude ground glide (map.easeTo() at zoom ~16, pitch 45°).
High-altitude 4-stage Space Orbit sequences MUST ONLY trigger on explicit action buttons ([ 🎬 RENDER 60FPS VIDEO ], [ 🪐 ORBIT VIEW ], [ ✈️ FLY OVER ]).

3. Git Branching & 3-Layer Defense Protocol
AI Workers MUST strictly comply with this 3-Layer Defense Mechanism to protect the production 3D map engine:
🚫 STRICT RULE: NEVER COMMIT OR PUSH DIRECTLY TO main!
Layer 1: Isolated Branch & Local Build Gate:


ALL work MUST be executed on a dedicated feature/fix branch:
Features: feature/<descriptive-name> (e.g., feature/onboarding-modal)
Fixes: fix/<issue-name> (e.g., fix/ground-camera-gliding)
Agent MUST verify clean local compilation (npm run build with exit code 0) before pushing the branch.
Layer 2: Cloudflare Preview Isolation & Verification:


Open a Pull Request (PR) from the feature branch targeting main.
NEVER test against local dev servers or localhost as proof of completion.
Playwright verification MUST be executed directly against the auto-generated Cloudflare Preview URL attached to the PR.
Layer 3: Local Conflict Resolution & Merge Gate:


Before requesting a merge, the Agent MUST pull the latest main (git fetch origin main && git merge origin/main) into the feature branch to detect and resolve all Git merge conflicts locally.
The PR can ONLY be merged into main after:
🟢 Cloudflare Preview build status is 🟢 Success.
🟢 All automated tests (npm run build, i18n parity, Playwright visual checks) pass.
🟢 User explicit approval is received in chat.

4. Deployment Configuration Standard (wrangler.toml)
All Cloudflare deployment configs MUST include an explicit [previews] block to prevent wrangler preview build failures:
name = "vibepath-web-client"
compatibility_date = "2026-11-01"
pages_build_output_dir = "./dist"

[assets]
directory = "./dist"

[build]
command = "npm run build"
watch_dir = "src"

[vars]
ENVIRONMENT = "production"
ENABLE_OSM_FALLBACK = "true"

# MANDATORY PREVIEWS BLOCK FOR WRANGLER 4.x+
[previews]

[previews.vars]
ENVIRONMENT = "preview"
ENABLE_OSM_FALLBACK = "true"

5. Design System Protocol: Cybernetic Swiss Brutalism
When modifying or creating any React UI components, AI Workers MUST strictly follow these visual rules:
Zero Border Radius Rule (Mandatory): border-radius: 0px !important on ALL elements. No soft rounded corners allowed anywhere.
Color Palette:
Primary Accent: #00E5FF (Electric Cyan)
Secondary Accent: #5322FF (Quantum Violet)
Telemetry Sensor: #00FF66 (Satellite Green)
Void Background: #05050A (Obsidian Black)
Panel Surface: #0D0E17 / Borders: 1px solid #1F1F2E
Bracket Syntax & Typography:
Wrap status readouts and titles in mechanical brackets: [ 01 // POI ], [ 🟢 GNSS_LOCKED ], [ 🗑️ CLEAR SESSION ].
Fonts: Space Grotesk for headers, JetBrains Mono for telemetry and coordinate values.

6. Micro-Tasking & AI Execution Protocols
Scope Limit per Ticket:
If a task involves >3 files or >150 lines of diff, split it into independent sub-tasks (e.g., Sub-Task 1: i18n & UI State, Sub-Task 2: Form Reset, Sub-Task 3: LocalStorage & 3D Line Rendering).
Fresh Session Protocol:
After completing 2 heavy sub-tasks, request a fresh chat context window to prevent LLM context degradation or zombie test processes.

7. Definition of Done (DoD) & PR Checklist
Before submitting any Pull Request, AI Workers MUST complete and verify this checklist:
[ ] Branch Isolation: Code is pushed to a dedicated feature/* or fix/* branch (NOT main).
[ ] Conflict-Free: Rebased/Merged latest main with 0 unresolved Git conflicts.
[ ] Local Build: npm run build exits cleanly with code 0.
[ ] Translation Parity: bun run scripts/test-i18n.ts confirms 100% key parity between en.ts and vi.ts.
[ ] Preview Verification: Visual checks confirmed on Cloudflare PR Preview deployment URL using Playwright.
[ ] Zero Radius Audit: All newly added elements strictly compute border-radius: 0px.
