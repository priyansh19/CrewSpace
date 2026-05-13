---
name: Desktop App Production Hardening
description: Take the CrewSpace Electron app from prototype to production-ready installer on Windows and macOS.
owner: desktop-lead
---

# Desktop App Production Hardening

## Goal

Ship a stable, signed, auto-updating desktop application for CrewSpace that bundles the server and UI into a native experience on Windows and macOS.

## Current state

- Windows NSIS installer builds and installs successfully
- MSI target configured but not primary
- No code signing (enterprise blocked by Device Guard/AppLocker)
- No macOS support
- No auto-updater
- Basic onboarding wizard implemented
- LAN access works via `0.0.0.0` binding with firewall rule documentation

## Success criteria

1. Signed Windows installer (OV code signing)
2. Signed and notarized macOS DMG
3. Auto-updater integrated and tested
4. Security audit passed (no unsafe eval, proper CSP, isolated preload)
5. Onboarding completion rate > 80% in smoke tests
