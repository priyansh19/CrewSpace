---
name: Implement auto-updater with electron-updater
project: desktop-app
assignee: desktop-platform
---

# Implement auto-updater with electron-updater

Add silent and manual update capabilities to the desktop app using `electron-updater`.

## Checklist

- [ ] Add `electron-updater` dependency
- [ ] Implement update check on app launch and periodic background check
- [ ] Design update UI: download progress, restart prompt, skip version
- [ ] Configure generic HTTP provider pointing to GitHub Releases or internal CDN
- [ ] Code-sign all distributed binaries (required for auto-updater on Windows/macOS)
- [ ] Test update flow from version N to N+1 on Windows and macOS
- [ ] Document release process for desktop in `doc/DEPLOYMENT-MODES.md` or new `desktop-electron/RELEASE.md`

## Acceptance criteria

- App automatically checks for updates within 5 minutes of launch
- User sees clear progress and restart prompt
- Unsigned builds gracefully disable auto-updater with a log message
