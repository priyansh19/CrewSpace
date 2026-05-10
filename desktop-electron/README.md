# CrewSpace Desktop (Electron)

A standalone Windows desktop application for CrewSpace, packaging the Express server and React UI into a single installable `.exe`.

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

```powershell
cd desktop-electron
pnpm start        # or: npx electron .
```

In dev mode:
- Electron is not packaged (`app.isPackaged === false`).
- The server is spawned via `tsx` from `../server/dist/index.js`.
- Workspace packages (`@crewspaceai/db`, etc.) are resolved via tsx's `.ts` import support.
- Server port: starts at 3150, finds first free port.

## Production Build

### Step 1: Prepare the server

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

### Step 2: Build the Electron app

```powershell
cd desktop-electron
pnpm build        # Creates dist/win-unpacked/ and dist/CrewSpace Setup.exe
```

The packaged app:
- Includes `server-prod/` as an `extraResource` at `resources/server/`.
- Runs the server using the bundled Node.js: `node resources/server/dist/index.js`.
- Server port: starts at 3150, finds first free port.

### Output

| Artifact | Path |
|---|---|
| Unpacked app | `desktop-electron/dist/win-unpacked/CrewSpace.exe` |
| NSIS installer | `desktop-electron/dist/CrewSpace Setup.exe` |

## Known Issues

### Device Guard / AppLocker
The unsigned `CrewSpace.exe` may be blocked by Windows Device Guard or AppLocker policies in enterprise environments. Code signing would resolve this.

### Port conflicts
The desktop app uses ports starting at 3150. If another CrewSpace instance (e.g., Docker on 3100, or another desktop app) is running, it will find the next available port automatically.

### Icon size
`assets/icon.ico` is too small for electron-builder (needs 256×256). The app currently uses the default Electron icon.

### Server change required for LAN
`server/src/index.ts` has a small patch to allow `local_trusted` mode to bind to `0.0.0.0` when `CREWSPACE_DESKTOP_MODE=1`. Without this, the server throws `local_trusted mode requires loopback host binding`.
