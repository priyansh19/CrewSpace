---
name: Add macOS build target and notarization
project: desktop-app
assignee: desktop-platform
---

# Add macOS build target and notarization

Extend the Electron build configuration to produce a signed, notarized `.dmg` for macOS.

## Checklist

- [ ] Add `mac` target to `electron-builder` config in `desktop-electron/package.json`
- [ ] Create `assets/icon.icns` from source logo (256×256 minimum)
- [ ] Set up Apple Developer account and certificates
- [ ] Configure `notarize` plugin or `electron-builder` notarization settings
- [ ] Test on Intel and Apple Silicon (universal or separate builds)
- [ ] Update `README.md` with macOS build instructions

## Acceptance criteria

- `pnpm build` on macOS produces `dist/CrewSpace.dmg`
- Gatekeeper allows installation without manual security override
- App launches and server starts successfully on a clean macOS install
