UI/UX PROTOCOL: CYBERNETIC SWISS BRUTALISM
**Document Version:** 2.4.0  
**Target Architecture:** Vite + React + TypeScript + Tailwind CSS (`lucide-react`)  
**Design Philosophy:** Cybernetic Swiss Brutalism (Zero Soft Radius, CAD Precision, Dark High-End Terminal)  
**Classification:** Engineering & Design Standard Guideline (Mandatory Protocol)

---

## 1. CORE PHILOSOPHY & DESIGN MANIFESTO

1. **Terminal Autonomy & CAD Precision:**  
   The application interface represents an industrial telemetry command deck and aerospace navigation console. Decorative softness, consumer-grade rounded shapes, and frivolous animations are strictly eliminated.
2. **Swiss International Typographic Discipline:**  
   Information architecture is governed by rigid grids, 1px delimitations, monospace telemetry data, and clear bracketed taxonomy (`[ 01 // CATEGORY ]`).
3. **High-Contrast Digital Ground:**  
   The visual environment rejects warm, muddy, or amber-orange tones typical of generic food-delivery apps. It operates exclusively on deep obsidian black paired with high-contrast digital accents: **Hyper Cyan (`#00E5FF`)**, **Quantum Violet (`#5322FF`)**, and **Satellite Emerald (`#00FF66`)**.

---

## 2. COLOR PALETTE SPECIFICATION & TOKEN MAPPING

```
+-----------------------------------------------------------------------------------------+
|                                    PALETTE HIERARCHY                                    |
|                                                                                         |
|  [ VOID CANVAS ]        [ MODULE SURFACE ]     [ TECHNICAL BORDERS ]                    |
|  #05050A                #0A0C14 / #0D0E17      #1F1F2E / #2D2D44                        |
|                                                                                         |
|  [ HYPER CYAN ]         [ QUANTUM VIOLET ]     [ SATELLITE GREEN ]   [ CADMIUM NEUTRAL] |
|  #00E5FF (Primary CTA)  #5322FF (NLE/Core)     #00FF66 (Telemetry)   #8A8FA3 (Labels)   |
+-----------------------------------------------------------------------------------------+
```

### 2.1 Color Tokens Registry

| Token Key | HEX Code | CSS Variable | Functional Usage |
| :--- | :--- | :--- | :--- |
| `GROUND_VOID` | `#05050A` | `--bg-void` | Absolute viewport background, full-screen canvas base. |
| `SURFACE_PANEL` | `#0A0C14` | `--surface-panel` | Bento cell background, drawer surface, modal body. |
| `SURFACE_ELEVATED`| `#0D0E17` | `--surface-elevated`| Toolbar background, input field ground, secondary rack. |
| `BORDER_MUTED` | `#1F1F2E` | `--border-muted` | Standard 1px module divider, inactive borders. |
| `BORDER_SUBTLE` | `#2D2D44` | `--border-subtle` | Structural section delimiters and separators. |
| `ACCENT_CYAN` | `#00E5FF` | `--brand-cyan` | Interactive focus, flight polyline vector, primary highlight. |
| `ACCENT_VIOLET` | `#5322FF` | `--brand-violet` | NLE timeline container, core command trigger background. |
| `SIGNAL_GREEN` | `#00FF66` | `--brand-satellite`| GNSS lock indicator, RTK status, live telemetry pulse. |
| `TEXT_PRIMARY` | `#FFFFFF` | `--text-primary` | High-contrast headers, active button labels. |
| `TEXT_MUTED` | `#8A8FA3` | `--text-muted` | Technical telemetry readouts, inactive options, specs. |

### 2.2 Prohibited Colors
- **NO AMBER / WARM ORANGE:** `#F4511E`, `#FFB300`, `#FF5722` are strictly deprecated and prohibited across all viewports.
- **NO NEON FLOODING:** Cyan (`#00E5FF`) must never be applied indiscriminately to all borders or cards. It serves exclusively as a high-priority action indicator.

---

## 3. GEOMETRY, BORDERS & SHAPING

### 3.1 Strict Zero Radius Rule (Absolute Mandate)
```css
/* GLOBAL DIRECTIVE */
*, *::before, *::after {
  border-radius: 0px !important;
}
```
No curved edges (`rounded-sm`, `rounded-md`, `rounded-xl`, `rounded-full`) may exist across buttons, input boxes, modal containers, cards, badges, dropdowns, or tooltips.

### 3.2 Mechanical 45-Degree Corner Notch (Chiseled Geometry)
Primary Call-to-Action buttons (e.g., `RENDER 60FPS VIDEO`, `DOWNLOAD ALL ASSETS`) and primary trigger surfaces must implement a mechanical 45° corner notch via `clip-path`:

```css
/* Mechanical Top-Right & Bottom-Left Chisel */
.mechanical-chisel {
  clip-path: polygon(
    0 0, 
    calc(100% - 10px) 0, 
    100% 10px, 
    100% 100%, 
    10px 100%, 
    0 calc(100% - 10px)
  );
}
```

### 3.3 Delimitation Lines
- All component borders must be exactly `1px solid`.
- Soft blurry drop-shadows (`box-shadow: 0 10px 25px rgba(...)`) are strictly prohibited.
- Subtle glow effects must be restricted to crisp 1px strokes or high-density linear boundaries.

---

## 4. TYPOGRAPHY & BRACKET TAXONOMY

### 4.1 Font Family Stacks
- **Technical Headings & Action Labels:** `'Space Grotesk'`, `'Inter'`, sans-serif (`font-semibold` / `font-bold`, uppercase, tracking-wider).
- **Telemetry Readouts, Coordinates, Code & Timers:** `'JetBrains Mono'`, `'Fira Code'`, monospace (`font-variant-numeric: tabular-nums`).

### 4.2 Machine-Syntax Bracket Wrapping
All status indicators, category headers, tags, and action targets must follow the mechanical bracket enclosure rule:
- Section header: `[ 01 // VECTOR_TRACK ]`
- GNSS coordinate: `[ LAT: 10.7629°N // LON: 106.7009°E ]`
- System state: `[ ⏣ GNSS_LOCKED • RTK_STABLE ]`
- Dismissal/Close: `[ × DISMISS ]`

---

## 5. TECHNICAL ICONOGRAPHY SPECIFICATION

```
+-----------------------------------------------------------------------------------------+
|                                ICON ENGINEERING RULES                                   |
|                                                                                         |
|  [ STROKE SPEC ]             [ BOUNDING BOX ]              [ RENDER ENGINE ]            |
|  1.25px - 1.50px             14px - 18px                   lucide-react                 |
|  Linecap: square             No icons > 20px               Vector Lineart Only          |
|  Linejoin: miter             Direct label alignment        Zero solid fill fills        |
+-----------------------------------------------------------------------------------------+
```

### 5.1 Geometry & Stroke Parameters
- **Icon Source:** `lucide-react` only.
- **Stroke Parameters:**
  - `strokeWidth`: `1.25` (Standard) to `1.5` (Interactive Focus).
  - `strokeLinecap`: `"square"`.
  - `strokeLinejoin`: `"miter"`.
- **Bounding Dimensions:**
  - Viewport/HUD Sub-controls: `size={14}` or `size={16}`.
  - Primary Action / Menu Buttons: `size={16}` or `size={18}`.
  - Strict maximum size: `20px`.

### 5.2 Icon Color Rules
- **Default/Idle State:** Stroke color `#8A8FA3`.
- **Active State / Toggled On:** Stroke color `#00E5FF`.
- **Master CTA / Progress Status:** Stroke color `#00FF66` (Pulse or slow spin).
- **Prohibited:** Multi-color icons, gradients on icons, and native OS emojis (🎬, 🚀, ⭐, 📍, 🐞).

### 5.3 Icon Registry Mapping

| Functional Target | Prohibited (DO NOT) | Required Lineart Icon (`lucide-react`) | Technical Role |
| :--- | :--- | :--- | :--- |
| **Field Tracker View** | Colorful map pins, map drops | `<Crosshair size={16} strokeWidth={1.25}/>` | Spatial positioning & tracking. |
| **Editor Studio** | Film reels, scissors | `<Layers size={16} strokeWidth={1.25}/>` | NLE compositing layers. |
| **Feedback / Bug Triage**| Cartoon bugs, star badges | `<Terminal size={16} strokeWidth={1.25}/>` | Telemetry logs & dispatch. |
| **GNSS Satellite Lock** | Arched Wi-Fi bars | `<Satellite size={14} strokeWidth={1.25}/>` | L1/L5 constellation lock. |
| **3D Terrain Mode** | Mountain silhouettes | `<Boxes size={14} strokeWidth={1.25}/>` | Digital elevation mesh. |
| **Volumetric CAD** | Generic building icons | `<Box size={14} strokeWidth={1.25}/>` | Volumetric building mesh. |
| **Orbit View** | Eye cartoon icons | `<Compass size={14} strokeWidth={1.25}/>` | Camera radial bearing. |
| **Flyover Mode** | Commercial airplane | `<Navigation size={14} strokeWidth={1.25}/>` | Vector flight path. |
| **Master Render CTA** | Play triangles, film rolls | `<Disc3 size={14} strokeWidth={1.5}/>` | 60FPS encoder trigger. |
| **Studio Asset Download**| Fat multi-colored arrows | `<HardDriveDownload size={14} strokeWidth={1.25}/>`| Binary package fetch. |

---

## 6. INTERACTION LOGIC & DECISION ARCHITECTURE

### 6.1 Viewport Controls vs. Action Command Trigger Decoupling
To eliminate cognitive confusion, **State Toggles (Viewport Modes)** must be physically and visually separated from **Action Command Triggers (Render/Export)**:

```
[--- SEGMENTED TOGGLE GROUP (1px #1F1F2E) ---]    [1px DIVIDER]    [--- MASTER CTA COMMAND ---]
[● 3D TERRAIN] [CAD] [ORBIT] [FLYOVER]                 |           [ ⏣ > RENDER 60FPS VIDEO ]
(State Toggle: Only active button lights up)        (12px Gap)      (Always lit: #5322FF / #00E5FF)
```

1. **State Selector Group (Left):**
   - Single contiguous container wrapped in `1px solid #1F1F2E`.
   - Mutually exclusive selection. Only the currently active state illuminates in `#00E5FF`.
2. **Master CTA Trigger (Right):**
   - Decoupled via `12px` clearance gap or vertical `1px #2D2D44` divider.
   - Applies the 45° chiseled corner cut (`clip-path`).
   - Constant high-luminance visibility (`bg-[#5322FF]`, `border-[#00E5FF]`, `text-white`), unaffected by viewport tab states.
   - Houses a live pulse beacon (`#00FF66`).

### 6.2 Async State & Feedback Protection
- **Double-Click Prevention:** Action buttons must lock state immediately upon click (`disabled={isSubmitting}`).
- **Execution Feedback:** Long-running processes (Render 3D, Dify Scripting) must render a 3-step dynamic stepper rather than an indefinite freeze:
  1. `[✓] INTERPOLATING B-SPLINE PATH`
  2. `[⚙] DIFY AI GENERATING SUBTITLES`
  3. `[ ] PACKAGING 4K 60FPS ASSET`

### 6.3 Responsive Viewport Isolation
- Mobile navigation overlays (`BottomNav.tsx`) must be completely unmounted or hidden when the workspace enters Desktop/Studio mode to prevent dual-dock vertical collision.

---

## 7. PROTOCOL DO'S & DO NOT'S SUMMARY MATRIX

```
+-----------------------------------------------------------------------------------------+
|                                 DO'S vs DO NOT'S                                        |
|                                                                                         |
|  DO:                                          DO NOT:                                   |
|  - border-radius: 0px everywhere              - No rounded corners (> 0px)              |
|  - 45° chiseled corner cuts on CTAs           - No warm orange/amber (#F4511E)          |
|  - 1px solid CAD grid borders                 - No blurry gaussian drop-shadows         |
|  - Strict bracket labeling [ 01 // TAG ]      - No wall-to-wall cyan border spam        |
|  - Monochrome square lineart icons            - No emojis, stars, or cartoon icons      |
|  - Decouple view toggles from actions         - No grouped CTA/toggle buttons           |
|  - Tabular monospace numbers                  - No truncated labels with '...'          |
+-----------------------------------------------------------------------------------------+
```

| Component | Standard Implementation (DO) | Strict Prohibition (DO NOT) |
| :--- | :--- | :--- |
| **Buttons (Master CTA)** | `bg-[#5322FF] border-[#00E5FF]`, 45° mechanical clip-path, white text, `#00FF66` indicator pulse. | Never use rounded pill shapes; never use orange fills; never embed into view-toggle groups. |
| **Buttons (Secondary/Files)**| `bg-[#0D0E17] border-[#1F1F2E] text-[#8A8FA3]`. Hover: `border-[#00E5FF] text-white`. | Never outline all idle secondary buttons in bright cyan simultaneously. |
| **Cards & Panels** | `bg-[#0A0C14] border-[#1F1F2E]`, 0px radius, header formatted as `[ 00 // TITLE ]`. | Never use soft drop-shadows or floating borderless cards. |
| **Status Indicators** | Single 1.5px green dot, square bracket notation: `[ 🟢 GNSS_LOCKED ]`. | Never use rounded pill chips or multi-color gradients. |
| **Rating / Feedback** | 5-step technical signal gauge: `[ █ █ █ ░ ░ ] (3/5)`. | Never use consumer cartoon 5-star badges. |
| **Text & Content** | Complete, unabbreviated feature titles on single-line monospace badges. | Never allow text clipping or ellipsis (`...`) within action targets. |

---

## 8. CODE REFERENCE IMPLEMENTATIONS

### 8.1 Primary Mechanical Action Button (`BrutalistButton.tsx`)
```tsx
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface BrutalistButtonProps {
  label: string;
  subLabel?: string;
  icon?: LucideIcon;
  onClick: () => void;
  isLoading?: boolean;
}

export const BrutalistButton: React.FC<BrutalistButtonProps> = ({
  label,
  subLabel,
  icon: Icon,
  onClick,
  isLoading = false,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      style={{
        clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))'
      }}
      className="group relative px-4 py-2 bg-[#5322FF] text-white font-mono text-xs font-semibold tracking-wider flex items-center gap-2.5 border border-[#00E5FF] hover:bg-[#00E5FF] hover:text-[#05050A] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed select-none"
    >
      <span className="w-1.5 h-1.5 bg-[#00FF66] animate-pulse group-hover:bg-[#05050A]" />
      {Icon && <Icon size={14} strokeWidth={1.5} strokeLinecap="square" strokeLinejoin="miter" />}
      <span>{isLoading ? '[ EXECUTING... ]' : label}</span>
      {subLabel && (
        <span className="text-[10px] text-[#00E5FF] group-hover:text-[#05050A] opacity-80">
          [{subLabel}]
        </span>
      )}
    </button>
  );
};
```

### 8.2 Standard Technical Icon Controller (`TechnicalIcon.tsx`)
```tsx
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface TechnicalIconProps {
  icon: LucideIcon;
  active?: boolean;
  isActionTrigger?: boolean;
  size?: number;
}

export const TechnicalIcon: React.FC<TechnicalIconProps> = ({
  icon: Icon,
  active = false,
  isActionTrigger = false,
  size = 14,
}) => {
  return (
    <Icon
      size={size}
      strokeWidth={1.25}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={`transition-colors duration-150 ${
        isActionTrigger
          ? 'text-[#00FF66]'
          : active
          ? 'text-[#00E5FF]'
          : 'text-[#8A8FA3] group-hover:text-white'
      }`}
    />
  );
};
```

---

## 9. COMPLIANCE & ACCEPTANCE CRITERIA (FOR AI AGENTS & ENGINEERS)

Before any PR merge or code deployment, verify:
- [ ] Every element in DOM inspector has computed `border-radius: 0px`.
- [ ] No hex color belongs to the banned orange/warm spectrum (`#F4511E`, `#FFB300`).
- [ ] Cyan `#00E5FF` is applied selectively to primary interactions, not flooding static panels.
- [ ] All icons are imported from `lucide-react` with linecap square, linejoin miter, and max size 18px.
- [ ] Map Viewport Mode selectors and Command Action buttons reside in distinct visual zones.
- [ ] No button labels wrap into multiple lines or get truncated with ellipsis.
- [ ] Dynamic branding variables (`--brand-cyan`, `--brand-violet`) propagate cleanly to downstream video renderers.