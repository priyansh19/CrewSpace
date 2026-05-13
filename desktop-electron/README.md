# CrewSpace Desktop (Electron)

A standalone desktop application for CrewSpace, packaging the Express server and React UI into installable packages for Windows, macOS, and Linux.

## Architecture

- **Electron main process** (`main.js`): Manages window, system tray, and spawns the Node.js server as a child process.
- **Server**: The CrewSpace Express API server runs embedded PostgreSQL and serves the static UI.
- **UI**: The same React board UI served by the server at `http://127.0.0.1:<port>`.

## Local Network Access

The desktop app binds the server to `0.0.0.0` so other devices on the same network can access CrewSpace.

- **Electron window**: Loads from `http://127.0.0.1:<port>` (fast, secure, local-only).
- **Other devices**: Connect via the machine's LAN IP, e.g. `http://192.168.1.100:3150`.

The LAN URL is displayed on the loading screen and available in the system tray (**Copy LAN URL**).

### Firewall

Windows may block incoming connections on port 3150. If other devices cannot connect:

```powershell
# Run as Administrator
netsh advfirewall firewall add rule name="CrewSpace Desktop" dir=in action=allow protocol=tcp localport=3150-3160
```

## Dev Mode

The renderer app is built with Vite + React. In development, run the Vite dev server and Electron simultaneously:

```powershell
# Terminal 1: Vite dev server (HMR for the React renderer)
cd desktop-electron
pnpm dev

# Terminal 2: Electron main process
cd desktop-electron
pnpm start        # or: npx electron .
```

In dev mode:
- Electron loads the renderer from `http://localhost:5173/` for hot-module replacement.
- The server is spawned via `tsx` from `../server/dist/index.js`.
- Workspace packages (`@crewspaceai/db`, etc.) are resolved via tsx's `.ts` import support.
- Server port: starts at 3150, finds first free port.

## Production Build

### Quick build (from repo root)

```powershell
# Build all platforms
pnpm build:desktop

# Platform-specific
pnpm build:desktop:win
pnpm build:desktop:mac
pnpm build:desktop:linux
```

### Manual build

#### Step 1: Prepare the server

```powershell
# From repo root
node scripts/prepare-desktop-server.mjs
```

This script:
1. Builds all workspace packages and adapters.
2. Temporarily patches workspace `package.json` exports from `src/*.ts` → `dist/*.js`.
3. Runs `pnpm deploy --filter @crewspaceai/server` to create `desktop-electron/server-prod`.
4. Copies `dist/` directories into deployed workspace packages (pnpm deploy doesn't include them).
5. Patches deployed adapter package.json exports.
6. Copies `ui-dist` into the deployed server.
7. Removes duplicate migrations (known project issue).
8. Restores original workspace `package.json` files.

#### Step 2: Build the Electron app

```powershell
cd desktop-electron
pnpm build:win    # Windows (NSIS + MSI)
pnpm build:mac    # macOS (DMG + ZIP)
pnpm build:linux  # Linux (AppImage + DEB + RPM)
```

The packaged app:
- Includes `server-prod/` as an `extraResource` at `resources/server/`.
- Runs the server using the bundled Node.js: `node resources/server/dist/index.js`.
- Server port: starts at 3150, finds first free port.

### Output

| Platform | Artifacts |
|---|---|
| Windows | `CrewSpace-Setup-{version}-x64.exe`, `CrewSpace-Setup-{version}-x64.msi` |
| macOS | `CrewSpace-{version}-x64.dmg`, `CrewSpace-{version}-arm64.dmg`, `.zip` |
| Linux | `CrewSpace-{version}-x64.AppImage`, `.deb`, `.rpm` |

## CI/CD Pipeline

The `.github/workflows/desktop.yml` workflow builds desktop artifacts on every push to `main` and for every version tag (`v*`, `canary/v*`).

- **Build matrix**: Windows (windows-latest), macOS (macos-latest), Linux (ubuntu-latest)
- **Artifacts**: Uploaded to GitHub Actions and attached to releases automatically
- **Smoke tests**: Linux AppImage and Windows unpacked builds are launched and verified against `/api/health`

### Code Signing

Set the following repository secrets to enable code signing in CI:

| Secret | Platform | Description |
|---|---|---|
| `APPLE_CERTIFICATE` | macOS | Base64-encoded `.p12` Developer ID certificate |
| `APPLE_CERTIFICATE_PASSWORD` | macOS | Certificate password |
| `APPLE_ID` | macOS | Apple ID for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | macOS | App-specific password for notarization |
| `APPLE_TEAM_ID` | macOS | Apple Developer Team ID |
| `WIN_CSC_LINK` | Windows | Base64-encoded `.pfx` code signing certificate |
| `WIN_CSC_KEY_PASSWORD` | Windows | Certificate password |

If secrets are not configured, builds proceed unsigned (suitable for internal/testing use).

## Auto-Update

CrewSpace Desktop uses `electron-updater` with GitHub Releases as the update provider.

- **Check frequency**: On app startup and every 4 hours
- **Download**: Automatic in the background
- **Install**: Prompts the user when the update is ready; installs on quit or immediately

The updater reads the `build.publish` config in `package.json` to locate the GitHub repository.

## First-Run Onboarding

On first launch, the app presents a **modern 5-step onboarding wizard**:

1. **Welcome** — Animated logo with "Get Started"
2. **Feature Carousel** — Auto-advancing highlights of CrewSpace capabilities
3. **Theme Picker** — Light / Dark preview cards
4. **Connect Services** — Optional GitHub App and Kimi Code API key setup
5. **Launch** — Animated checkmark with progress bar

Credentials are encrypted at rest (`%LOCALAPPDATA%\CrewSpace\desktop-config.enc` on Windows, `~/Library/Application Support/CrewSpace/desktop-config.enc` on macOS) and injected as environment variables into the server process. You can skip any step and configure later via the board UI.

## Known Issues

### Device Guard / AppLocker
Unsigned builds may be blocked by Windows Device Guard or AppLocker policies in enterprise environments. Code signing resolves this.

### Port conflicts
The desktop app uses ports starting at 3150. If another CrewSpace instance (e.g., Docker on 3100, or another desktop app) is running, it will find the next available port automatically.

### Icon size
`assets/icon.ico` is too small for electron-builder (needs 256×256). The app currently uses the default Electron icon on some platforms.

### Server change required for LAN
`server/src/index.ts` has a small patch to allow `local_trusted` mode to bind to `0.0.0.0` when `CREWSPACE_DESKTOP_MODE=1`. Without this, the server throws `local_trusted mode requires loopback host binding`.
