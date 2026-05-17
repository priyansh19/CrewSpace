# CrewSpace Installer Wizard — Implementation Plan

> **Date:** 2026-05-17  
> **Branch:** `feature/installer-wizard` (branched from `main`)  
> **Target:** A visually stunning, Claude-themed Windows installer with an animated feature carousel  
> **Design Spec:** `DESIGN.md` from `crewspace` folder (warm cream canvas, coral CTAs, Cormorant Garamond serif, Inter sans)  
> **Project:** `crewspace-v2` (latest)

---

## 1. Architecture Decision

### Chosen Approach: Custom Electron Bootstrap Installer

Build a **small standalone Electron app** that acts as the installer wizard. This is the same pattern used by Discord, Figma, Linear, and Slack.

**Why this approach:**
- **Full creative control** — React + Tailwind + Framer Motion for stunning animations
- **Reuses existing tech stack** — Vite, React, TypeScript, Tailwind CSS v4, electron-builder
- **Strictly follows DESIGN.md** — cream canvas, coral accents, serif headlines without NSIS UI limits
- **Cross-platform ready** — Windows portable .exe now; macOS .app bootstrapper later with 80% code reuse
- **No external dependencies** — Users download one file; offline install works

**How it works:**
1. User downloads `CrewSpace-Setup.exe` (the installer wizard, ~8–12 MB)
2. Wizard opens in a beautiful **frameless 960×640 window** with the Claude-themed carousel
3. User clicks "Install CrewSpace"
4. Wizard extracts the **bundled main app payload** to `%LOCALAPPDATA%\CrewSpace\app`
5. Creates Start Menu + Desktop shortcuts pointing to the extracted app
6. Optionally launches CrewSpace on finish

### Why NOT standard NSIS enhancement?
- NSIS custom pages are limited to Win32 controls (labels, buttons, images)
- No smooth animations, no carousel transitions, no CSS layouts
- WebView2 plugins for NSIS exist but are fragile and unsigned
- The team already has expertise in Electron/React — no new toolchain needed

---

## 2. Directory Structure

```
desktop-electron/
  installer/                          # NEW: Installer wizard package
    package.json                      # Own deps: electron, vite, react, framer-motion
    vite.config.ts                    # Builds renderer; targets port 5275
    tsconfig.json
    electron-builder.yml              # Builds setup.exe as portable
    index.html                        # Entry HTML with font preconnects
    src/
      main.ts                         # Electron main: frameless window, single-instance
      preload.ts                      # Secure IPC bridge
      renderer/
        main.tsx                      # React root
        App.tsx                       # State machine: Welcome → Carousel → Install → Done
        components/
          InstallerLayout.tsx         # Frameless title bar + background canvas
          WelcomeScreen.tsx           # Logo + tagline + "Get Started" CTA
          FeatureCarousel.tsx         # Main carousel with auto-advance
          FeatureSlide.tsx            # Individual slide wrapper
          SlideIllustration.tsx       # Procedural SVG illustrations per slide
          ProgressPanel.tsx           # File extraction progress + logs
          CompleteScreen.tsx          # Success state + "Launch CrewSpace"
          StepIndicator.tsx           # 1-2-3 step dots
          AnimatedBackground.tsx      # Subtle noise texture + gradient
          NavigationArrows.tsx        # Left/right carousel controls
        hooks/
          useInstaller.ts             # Installation orchestration hook
          useCarousel.ts              # Auto-advance + manual nav state
        lib/
          installer-logic.ts          # Zip extraction, shortcut creation, registry
          features.ts                 # Carousel content (6 slides)
        styles/
          installer.css               # CSS vars from DESIGN.md + global resets
    assets/
      icon.ico                        # Reuse from desktop-electron/assets/icon.ico
      logo.svg                        # CrewSpace mark + wordmark
      payload/                        # Populated at build time
        app.zip                       # The main CrewSpace app bundle
```

---

## 3. UI Design Specification (from DESIGN.md)

### Color Palette
| Token | Hex | Usage |
|---|---|---|
| `canvas` | `#faf9f5` | Page background |
| `surface-card` | `#efe9de` | Feature slide card backgrounds |
| `surface-dark` | `#181715` | Product mockup panels, code windows |
| `primary` | `#cc785c` | "Install" CTA, progress bar fill, active dots |
| `primary-active` | `#a9583e` | CTA hover / press state |
| `ink` | `#141413` | Headlines |
| `body` | `#3d3d3a` | Body text |
| `muted` | `#6c6a64` | Captions, step labels |
| `hairline` | `#e6dfd8` | Borders, dividers |
| `success` | `#5db872` | Completed step indicator |

### Typography
| Role | Font | Weight | Size | Letter-Spacing |
|---|---|---|---|---|
| Hero display | Cormorant Garamond | 400 | 48px | -1px |
| Slide titles | Cormorant Garamond | 400 | 36px | -0.5px |
| Body | Inter | 400 | 16px | 0 |
| Buttons | Inter | 500 | 14px | 0 |
| Captions | Inter | 500 | 13px | 0 |
| Code/logs | JetBrains Mono | 400 | 13px | 0 |

### Layout
- **Window size:** 960 × 640 px, frameless, centered on screen
- **Custom title bar:** 32px height, cream background, draggable `-webkit-app-region: drag`
- **Max content width:** 800px centered
- **Section rhythm:** 48px vertical padding, 32px horizontal
- **Border radius:** 8px buttons, 12px cards, 9999px pills/badges

### Motion
- **Page transitions:** Framer Motion `AnimatePresence` with `opacity` + `y: 20→0`
- **Slide transitions:** `x: 100→0` with spring physics (stiffness: 300, damping: 30)
- **Auto-advance:** 6000ms per slide, pauses on hover
- **Progress bar:** CSS `transition: width 6s linear` synced to auto-advance
- **Reduced motion:** All transitions disabled when `prefers-reduced-motion: reduce`

---

## 4. Installation Flow (State Machine)

```
┌──────────┐     Get Started      ┌──────────┐     Install      ┌──────────┐
│ WELCOME  │ ───────────────────> │ CAROUSEL │ ───────────────> │INSTALLING│
│  Screen  │                      │ 6 Slides │                  │ Progress │
└──────────┘                      └──────────┘                  └────┬─────┘
                                                                     │
                                                                     │ Done
                                                                     ▼
                                                               ┌──────────┐
                                                               │ COMPLETE │
                                                               │  Screen  │
                                                               └────┬─────┘
                                                                    │
                                                                    └─> Launch App
```

### State 1: Welcome Screen
- **Background:** `canvas` with subtle animated noise texture (CSS `background-image` data URI)
- **Center content:**
  - CrewSpace logo mark (48px) + wordmark in Cormorant Garamond 28px
  - Tagline: *"The control plane for autonomous AI companies"* (display-md, ink)
  - Subline: *"Spin up an AI-native organization — org chart, goals, budgets, approvals, and plugins — all from one board."* (body-md, muted)
  - **Primary CTA:** "Get Started" — coral background, white text, 48px height, full-width max 320px
  - **Secondary link:** "Learn more" → opens `https://crewspace.ing` in system browser
- **Footer:** "On-premise · Private · Secure" (caption, muted-soft)

### State 2: Feature Carousel (6 slides, auto-advancing)

Each slide layout:
- **Left 55%:** Large procedural SVG illustration (dark navy `surface-dark` card with product chrome)
- **Right 45%:** Title (serif 36px), description (body 16px), 2–3 bullet highlights
- **Bottom center:** Dot indicators (6 dots, active = coral filled, inactive = hairline border)
- **Bottom sides:** Circular arrow buttons (36px, canvas background, hairline border)
- **Top:** Thin coral progress bar showing time until next slide

**Slide 1 — Agent Orchestration**
- Title: *"Hire AI agents that actually work together"*
- Body: *"Connect Claude, Codex, Cursor, Gemini, Kimi, and more. Each agent gets a role in your org chart, reports to a manager, and pulls work from a shared queue."*
- Bullets: Multi-adapter support · Atomic task checkout · Live heartbeat monitoring
- Visual: Animated org tree diagram with 3 agent nodes pulsing in teal

**Slide 2 — 3D Office & Presence**
- Title: *"Your team, visualized"*
- Body: *"Watch your AI company come alive in a 3D office. See who's active, what they're working on, and tap any agent to jump into a live session."*
- Bullets: Real-time presence · Spatial collaboration · Live workspace access
- Visual: Isometric room with desks, chairs, and glowing agent avatars

**Slide 3 — Memory Graph**
- Title: *"Collective memory, not scattered context"*
- Body: *"Every conversation, decision, and output is woven into a living knowledge graph. Agents remember what the company knows — no prompt hacking required."*
- Bullets: Semantic connections · Auto-summarization · Cross-agent recall
- Visual: Network graph with 12+ nodes, coral + teal edges, animated pulse along connections

**Slide 4 — Budget Hard-Stops**
- Title: *"Cost control that actually stops spending"*
- Body: *"Set daily, weekly, or monthly budgets per agent and per company. When the limit hits, work pauses automatically — no surprise API bills."*
- Bullets: Per-agent budgets · Auto-pause on threshold · Cost rollup dashboards
- Visual: Circular budget gauge filling up; turns from teal to coral near limit

**Slide 5 — Approval Gates**
- Title: *"Governance without bureaucracy"*
- Body: *"Require human approval for high-stakes actions — agent hiring, strategy changes, large purchases. Approve in one click from the board or your phone."*
- Bullets: Configurable gates · One-click approve · Audit trail
- Visual: Approval card mockup (dark surface) with "Approve" / "Deny" buttons

**Slide 6 — Plugin Marketplace**
- Title: *"Extensible by design"*
- Body: *"Install plugins to add new skills, integrations, and workflows. Build your own with the Plugin SDK and publish to the marketplace."*
- Bullets: Plugin SDK · Community marketplace · Third-party integrations
- Visual: Grid of 4 plugin cards with icons, names, and "Install" buttons

**Carousel controls:**
- Keyboard: `ArrowLeft` / `ArrowRight` to navigate
- Mouse: Click arrows or dots
- Touch: Swipe left/right (if we add touch support later)
- Auto-advance pauses on hover, resumes on mouse leave

### State 3: Installing Screen
- Carousel fades out via `AnimatePresence`
- **Large progress bar:** 4px height, full width, coral fill animating with extraction progress
- **Step labels:**
  1. "Extracting files…" (spinner while < 30%)
  2. "Creating shortcuts…" (30–60%)
  3. "Finalizing setup…" (60–100%)
- **Optional detail:** Expandable log panel (dark card, JetBrains Mono, 13px) showing extraction paths
- **Estimated time:** "About 10 seconds remaining" (calculated from throughput)

### State 4: Complete Screen
- Green success checkmark (animated SVG stroke draw, 600ms)
- Title: *"CrewSpace is ready"* (display-md)
- Body: *"Your AI company control plane is installed and ready to run."* (body-md, muted)
- **Primary CTA:** "Launch CrewSpace" (coral, full-width max 320px)
- **Secondary actions:**
  - Checkbox: "Create desktop shortcut" (checked by default)
  - Text link: "Open installation folder"
- On launch: spawns the installed app and fades installer window

---

## 5. Technical Implementation

### 5.1 Payload Bundling

The main CrewSpace app must be bundled into the installer.

**Build pipeline step:**
```bash
# 1. Build main app renderer
pnpm --filter desktop-electron build:renderer

# 2. Package main app as directory (not NSIS)
pnpm --filter desktop-electron electron-builder --dir --win

# 3. Zip the unpacked app
node scripts/zip-payload.mjs \
  --input desktop-electron/dist/win-unpacked \
  --output desktop-electron/installer/assets/payload/app.zip

# 4. Build installer wizard
pnpm --filter installer build

# 5. Package installer as portable .exe
pnpm --filter installer electron-builder --win portable
```

### 5.2 Extraction Logic (Node.js main process)

```ts
// src/main.ts — IPC handler
ipcMain.handle("install", async () => {
  const appDataDir = path.join(os.homedir(), "AppData", "Local", "CrewSpace");
  const targetDir = path.join(appDataDir, "app");
  const zipPath = path.join(__dirname, "..", "assets", "payload", "app.zip");

  // Ensure clean target
  await fs.promises.rm(targetDir, { recursive: true, force: true });
  await fs.promises.mkdir(targetDir, { recursive: true });

  // Extract with progress
  await extractZip(zipPath, targetDir, (percent) => {
    mainWindow?.webContents.send("install-progress", { percent, stage: "extract" });
  });

  // Create shortcuts
  const exePath = path.join(targetDir, "CrewSpace.exe");
  await createStartMenuShortcut(exePath, "CrewSpace");
  await createDesktopShortcut(exePath, "CrewSpace");

  mainWindow?.webContents.send("install-progress", { percent: 100, stage: "done" });
  return { success: true, installPath: targetDir };
});
```

### 5.3 Windows Shortcut Creation

Using `windows-shortcuts` npm package or PowerShell fallback:

```ts
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function createDesktopShortcut(targetPath: string, name: string): Promise<void> {
  const desktopPath = path.join(os.homedir(), "Desktop", `${name}.lnk`);
  const ps = `
    $WshShell = New-Object -comObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut('${desktopPath.replace(/'/g, "''")}')
    $Shortcut.TargetPath = '${targetPath.replace(/'/g, "''")}'
    $Shortcut.WorkingDirectory = '${path.dirname(targetPath).replace(/'/g, "''")}'
    $Shortcut.Save()
  `;
  await execAsync(`powershell -Command "${ps.replace(/"/g, '\"')}"`);
}
```

### 5.4 IPC Bridge (preload.ts)

```ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("installerAPI", {
  // Installation
  install: () => ipcRenderer.invoke("install"),
  onProgress: (cb: (e: InstallProgress) => void) =>
    ipcRenderer.on("install-progress", (_e, data) => cb(data)),

  // App lifecycle
  launchApp: () => ipcRenderer.invoke("launch-app"),
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  openInstallFolder: () => ipcRenderer.invoke("open-install-folder"),

  // Window controls
  minimizeWindow: () => ipcRenderer.send("minimize-window"),
  closeWindow: () => ipcRenderer.send("close-window"),
});
```

### 5.5 Carousel Auto-Advance

```ts
// hooks/useCarousel.ts
export function useCarousel(totalSlides: number) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (paused) return;
    intervalRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % totalSlides);
    }, 6000);
    return () => clearInterval(intervalRef.current);
  }, [paused, totalSlides]);

  const goTo = (i: number) => setIndex(i);
  const next = () => setIndex((i) => (i + 1) % totalSlides);
  const prev = () => setIndex((i) => (i - 1 + totalSlides) % totalSlides);

  return { index, goTo, next, prev, setPaused };
}
```

---

## 6. Build Integration

### Root `package.json` additions
```json
{
  "scripts": {
    "build:installer": "pnpm --filter installer build",
    "build:desktop:with-installer": "pnpm build:desktop && pnpm package:payload && pnpm build:installer",
    "package:payload": "node scripts/zip-installer-payload.mjs"
  }
}
```

### New workspace in `pnpm-workspace.yaml`
```yaml
packages:
  - "cli"
  - "desktop-electron"
  - "desktop-electron/installer"   # NEW
  - "packages/*"
  - "packages/adapters/*"
  - "packages/plugins/*"
  - "server"
```

### `scripts/zip-installer-payload.mjs`
```js
#!/usr/bin/env node
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import archiver from "archiver";

const input = process.argv.includes("--input")
  ? process.argv[process.argv.indexOf("--input") + 1]
  : "desktop-electron/dist/win-unpacked";

const output = process.argv.includes("--output")
  ? process.argv[process.argv.indexOf("--output") + 1]
  : "desktop-electron/installer/assets/payload/app.zip";

const archive = archiver("zip", { zlib: { level: 9 } });
const stream = createWriteStream(output);

archive.directory(input, false);
archive.finalize();
await pipeline(archive, stream);
console.log(`Payload zipped: ${output}`);
```

### `desktop-electron/installer/package.json`
```json
{
  "name": "crewspace-installer",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "build:app": "electron-builder --win portable"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "framer-motion": "^12.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "electron": "^33.0.0",
    "electron-builder": "^25.1.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  },
  "build": {
    "appId": "com.crewspaceai.installer",
    "productName": "CrewSpace Setup",
    "directories": { "output": "dist" },
    "files": ["main.js", "preload.js", "renderer-dist/**/*", "assets/**/*"],
    "win": {
      "target": "portable",
      "icon": "assets/icon.ico"
    },
    "portable": {
      "artifactName": "CrewSpace-Setup-${version}.exe"
    }
  }
}
```

---

## 7. Asset Requirements

| Asset | Format | Source / Generation |
|---|---|---|
| CrewSpace logo mark | SVG | Reuse `desktop-electron/src/renderer/public/logo.svg` |
| App icon | ICO | Reuse `desktop-electron/assets/icon.ico` |
| Feature illustrations | Inline SVG (React) | Procedurally generated — no external images |
| Background noise | CSS data URI | Tiny base64 SVG noise filter |

**No raster images required.** All visuals are code-generated SVG/CSS, ensuring:
- Zero licensing issues
- Always crisp at any DPI
- Tiny bundle size
- Easy to animate

---

## 8. Implementation Phases

### Phase 1 — Scaffold (2–3 hrs)
- [ ] Create `desktop-electron/installer/` directory tree
- [ ] Write `package.json`, `vite.config.ts`, `tsconfig.json`, `electron-builder.yml`
- [ ] Set up Electron main process (frameless 960×640, single-instance lock)
- [ ] Set up Vite + React + Tailwind renderer build
- [ ] Add Google Fonts (Cormorant Garamond, Inter, JetBrains Mono)
- [ ] Copy CSS variables from DESIGN.md into `installer.css`
- [ ] Add installer workspace to root `pnpm-workspace.yaml`

### Phase 2 — UI Shell & State Machine (3–4 hrs)
- [ ] Build `InstallerLayout` with custom draggable title bar (32px, cream)
- [ ] Build `StepIndicator` (3 dots, coral active state)
- [ ] Build `AnimatedBackground` (subtle CSS noise + radial gradient)
- [ ] Implement 4-state machine: Welcome → Carousel → Installing → Complete
- [ ] Add Framer Motion page transitions (fade + slide up)
- [ ] Wire IPC bridge (preload.ts)

### Phase 3 — Feature Carousel (5–6 hrs)
- [ ] Build `FeatureCarousel` container with `AnimatePresence`
- [ ] Build `FeatureSlide` layout component (55/45 split)
- [ ] Build `SlideIllustration` system — 6 unique procedural SVGs:
  - Org chart with pulsing nodes
  - 3D office isometric scene
  - Network graph with animated edges
  - Budget gauge with fill animation
  - Approval card mockup
  - Plugin marketplace grid
- [ ] Build `NavigationArrows` + dot indicators
- [ ] Implement `useCarousel` hook (auto-advance 6s, pause on hover)
- [ ] Add keyboard navigation (ArrowLeft / ArrowRight)
- [ ] Add progress bar synced to auto-advance timer

### Phase 4 — Installation Logic (3–4 hrs)
- [ ] Write `installer-logic.ts` — zip extraction with progress callbacks
- [ ] Write Windows shortcut creation (PowerShell via `child_process.exec`)
- [ ] Write `scripts/zip-installer-payload.mjs`
- [ ] Wire `useInstaller` hook to IPC `install` channel
- [ ] Build `ProgressPanel` with animated progress bar + step labels
- [ ] Build expandable log panel (dark card, monospace)

### Phase 5 — Complete & Polish (2–3 hrs)
- [ ] Build `CompleteScreen` with animated SVG checkmark
- [ ] Wire "Launch CrewSpace" button to spawn installed app
- [ ] Add "Create desktop shortcut" checkbox
- [ ] Add `prefers-reduced-motion` media query support
- [ ] Add focus rings and ARIA labels for accessibility
- [ ] Test full flow: build payload → build installer → run on clean VM

**Total estimated effort:** 15–20 hours of focused development

---

## 9. Testing Checklist

- [ ] Installer window opens at 960×640, frameless, centered
- [ ] Single-instance lock works (second click focuses existing window)
- [ ] Welcome screen matches DESIGN.md colors, fonts, spacing exactly
- [ ] Carousel auto-advances every 6 seconds
- [ ] Hovering carousel pauses auto-advance; leaving resumes
- [ ] Arrow keys navigate slides
- [ ] Dot indicators are clickable and sync to correct slide
- [ ] Each of 6 slides renders its unique SVG illustration
- [ ] "Install" button triggers extraction
- [ ] Progress bar updates smoothly (not jumping)
- [ ] Step labels change at correct progress thresholds
- [ ] Shortcuts created on Desktop and Start Menu
- [ ] "Launch CrewSpace" opens the installed app successfully
- [ ] Installer window closes after launch
- [ ] Works on Windows 10 (21H2+) and Windows 11
- [ ] Works when run from Downloads folder (no admin required — installs to AppData)
- [ ] Reduced-motion mode disables all animations

---

## 10. Open Questions & Decisions

| Question | Decision | Rationale |
|---|---|---|
| Should the installer require admin? | **No** — per-user install to `%LOCALAPPDATA%` | Silent install, no UAC prompt, works in corporate locked-down environments |
| Auto-update in installer? | **No** — out of scope | The installed app already has `electron-updater` built in |
| Bundle or download payload? | **Bundle** | Offline install; no CDN dependency; single-file download |
| macOS support? | **Phase 2** | Windows first. macOS `.app` bootstrapper reuses 80% of React code |
| Uninstaller styling? | **Reuse stock NSIS** | The installed app is extracted to a folder; uninstall is simply folder deletion + shortcut removal. Can be enhanced later. |
| Code signing? | **Out of scope** | Plan assumes unsigned. Signed builds are a CI/CD concern, not installer UI. |

---

## 11. Post-Install User Journey

```
User downloads CrewSpace-Setup.exe
         │
         ▼
┌─────────────────────┐
│   Run Setup.exe     │
│  (no admin needed)  │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Welcome Screen     │
│  "Get Started" CTA  │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Feature Carousel   │
│  6 slides, auto-play │
│  User can navigate  │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Click "Install"    │
│  ~10s extraction    │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Complete Screen    │
│  "Launch CrewSpace" │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  CrewSpace opens    │
│  First-run setup    │
│  (auth, company)    │
└─────────────────────┘
```

---

*Plan authored 2026-05-17 for `crewspace-v2` branch `feature/installer-wizard`.*  
*Ready for approval and Phase 1 implementation.*
