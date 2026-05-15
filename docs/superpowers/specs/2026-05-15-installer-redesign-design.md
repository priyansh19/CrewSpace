# Installer Redesign — Option C: Two-Phase Install Experience

## Goal

Replace the current bare-bones NSIS/DMG installers and placeholder onboarding HTML with a polished two-phase experience: a branded OS installer gets the app on disk in ~30 seconds, then a rich 4-screen in-app onboarding (React) does all the heavy lifting the first time the app launches.

---

## Architecture

### Phase 1 — OS Installer (new artwork only, existing electron-builder base)

The existing `electron-builder` NSIS and DMG configuration is kept. Only the installer artwork and NSH script change:

- **Windows NSIS**: new `installerSidebar.bmp` (164×314 px), `installerHeader.bmp` (150×57 px), `installer.nsh` with welcome/finish page customization
- **macOS DMG**: new `dmgBackground.png` (540×380 px), `dmgBackground@2x.png` (1080×760 px) via `electron-builder` `dmg.background`

Installer screens: Welcome splash → install location → animated progress → auto-launch on finish.

### Phase 2 — In-App Onboarding (new React component, replaces onboarding.html)

`main.js` already has first-run detection (`isFirstRunComplete()`) and loads `onboarding.html` on first launch. The old vanilla-JS `onboarding.html/css/js` is replaced with a React-based onboarding page served by Vite.

The new flow is a 4-screen wizard rendered inside the Electron window:

| Screen | ID | What happens |
|--------|-----|-------------|
| 1 | `feature-showcase` | Animated carousel of real app screenshots with feature callouts |
| 2 | `create-org` | Name your organisation, pick brand colour, optional logo upload |
| 3 | `connect-llm` | Choose LLM adapter (Claude, Gemini, Ollama, LM Studio, OpenAI), enter key or auto-detect local |
| 4 | `launch-dashboard` | Progress animation while: server saves org config, creates CEO agent, fires first heartbeat — user watches it happen live |

On completion, `window.electronAPI.completeOnboarding(prefs)` is called (existing IPC handler at `main.js:839`). Electron then loads the main React app at `/`.

### Data Flow

```
Phase 1 OS installer
  → launches Electron
      → main.js isFirstRun check
          → loads /onboarding route (Vite React)
              → OnboardingWizard component (4 screens)
                  → screen 4 calls completeOnboarding IPC
                      → main.js saves prefs, sets firstRunComplete = true
                      → loads main app at /
                          → app sees org + LLM already configured → routes to Dashboard
```

### Screenshot Capture

A Node script (`scripts/capture-screenshots.mjs`) spins up Playwright headless, logs into a running CrewSpace instance, and captures 6 reference screenshots for the feature carousel:
- `/` — Dashboard with CEO agent activity
- `/agents` — Agents grid
- `/office` — 3D office view
- `/issues` — Issues list
- `/proposals` — Proposals board
- `/routines` — Routines list

Screenshots land in `assets/onboarding/screenshots/` and are bundled into the Electron app via `extraResources`.

---

## Components

### New files
| File | Purpose |
|------|---------|
| `src/renderer/pages/Onboarding.tsx` | 4-screen wizard, replaces onboarding.html |
| `src/renderer/pages/onboarding/FeatureShowcase.tsx` | Screen 1: carousel |
| `src/renderer/pages/onboarding/CreateOrg.tsx` | Screen 2: org setup form |
| `src/renderer/pages/onboarding/ConnectLlm.tsx` | Screen 3: LLM adapter picker |
| `src/renderer/pages/onboarding/LaunchDashboard.tsx` | Screen 4: live CEO kickoff |
| `assets/installer/installerSidebar.bmp` | NSIS sidebar art (164×314, replaces old) |
| `assets/installer/installerHeader.bmp` | NSIS header art (150×57, replaces old) |
| `assets/installer/dmgBackground.png` | macOS DMG bg (540×380, replaces old .png) |
| `assets/installer/dmgBackground@2x.png` | macOS DMG bg @2x (1080×760) |
| `assets/onboarding/screenshots/` | 6 captured feature screenshots |
| `scripts/capture-screenshots.mjs` | Playwright screenshot capture |

### Modified files
| File | Change |
|------|--------|
| `src/App.tsx` (renderer) | Add `/onboarding` route → `<Onboarding />` |
| `main.js` | Change `onboarding.html` load to `#/onboarding` Vite route |
| `package.json` | Update `nsis.installerSidebarFile`, `nsis.installerHeaderFile`, `dmg.background`; remove `nsis.include` if NSH no longer needed |

### Deleted files
| File | Why |
|------|-----|
| `src/onboarding.html` | Replaced by React route |
| `src/onboarding.js` | Replaced by React component |
| `src/onboarding.css` | Replaced by Tailwind in React |
| `src/renderer/lib/onboarding-goal.ts` | Dead code after React onboarding |
| `src/renderer/lib/onboarding-goal.test.ts` | Paired test |
| `src/renderer/lib/onboarding-launch.ts` | Dead code |
| `src/renderer/lib/onboarding-launch.test.ts` | Paired test |
| `src/renderer/lib/onboarding-route.ts` | Dead code |
| `src/renderer/lib/onboarding-route.test.ts` | Paired test |
| `assets/installer/installerHeader.png` | Replaced by new BMP |
| `assets/installer/installerWelcome.png` | Unused |
| `scripts/installer.nsh` | Replaced by new NSH (or dropped if not needed) |
| `scripts/gen-installer-images.py` | Replaced by capture script |

---

## Onboarding Screen Details

### Screen 1 — Feature Showcase
- Full-bleed dark card (slate-900 bg)
- Auto-advancing carousel: each slide = screenshot + title + 2-line description
- Manual prev/next chevrons, dot indicators
- Bottom CTA: "Get Started →"

### Screen 2 — Create Organisation
- Logo mark at top, "Set up your workspace" heading
- Required: Organisation name (text input)
- Optional: Brand colour picker (6 preset swatches + custom hex)
- Optional: Logo upload (drag-or-click, PNG/SVG, 512×512 max)
- "Continue →" enabled when name is non-empty

### Screen 3 — Connect Your LLM
- Heading "Connect an AI model"
- 5 adapter cards (Claude, Gemini, Ollama, LM Studio, OpenAI) — single-select with glow border
- For cloud adapters: API key text input (masked, with show/hide toggle)
- For local adapters: auto-detect button that pings the default local port; shows "Found at http://localhost:11434" or error
- "Skip for now" ghost link (can configure later in Settings)
- "Continue →"

### Screen 4 — Launch Dashboard
- Animated progress sequence (5 steps, each ~1s apart, via setTimeout):
  1. "Saving workspace settings…"
  2. "Creating your organisation…" — calls `createOrg` IPC
  3. "Spinning up CEO agent…" — calls `createCeoAgent` IPC (or handled server-side after org creation)
  4. "Firing first heartbeat…" — calls `triggerHeartbeat` IPC
  5. "Welcome to CrewSpace!" — green checkmark, "Open Dashboard →" button
- On "Open Dashboard →": calls `completeOnboarding` IPC → main.js loads `#/`

---

## Error Handling

- Screen 3 (LLM key): if key is invalid, show inline red error under the input; allow retry
- Screen 4: if any IPC call fails, show "Something went wrong — Retry" link; log error to main process console
- If onboarding is aborted (window closed mid-flow), `isFirstRunComplete()` stays false → onboarding restarts on next launch

---

## Testing

- `src/renderer/pages/onboarding/*.tsx` components are pure React (no Electron IPC in unit tests) — mock `window.electronAPI` with `vi.fn()`
- Each screen tested for: renders without crashing, CTA disabled state, CTA enabled state, form validation
- No e2e tests for onboarding in this iteration (Playwright e2e would require a packaged build)

---

## What Stays The Same

- `electron-builder` base config (appId, productName, output dir)
- `main.js` `isFirstRunComplete()` / `completeOnboarding` IPC handler (existing logic kept)
- `main.js` first-run branch that loads the onboarding page (URL changes from `onboarding.html` to `#/onboarding`)
- All server-side code — org creation and CEO agent creation happen through existing REST endpoints

---

## Deliverables

1. `CrewSpace-Setup.exe` — Windows NSIS installer with new sidebar/header art
2. `CrewSpace-<version>.dmg` — macOS DMG with new background image
3. `src/renderer/pages/Onboarding.tsx` + 4 sub-screens
4. 6 feature screenshots in `assets/onboarding/screenshots/`
5. `scripts/capture-screenshots.mjs` — reusable screenshot capture script
6. All old installer and onboarding files deleted
