---
name: Harden Electron security model
project: desktop-app
assignee: desktop-lead
---

# Harden Electron security model

Audit and harden the Electron main process, preload, and renderer against common desktop app vulnerabilities.

## Checklist

- [ ] Review `contextIsolation`, `sandbox`, and `nodeIntegration` settings in `main.js`
- [ ] Validate preload script (`preload.js`) exposes only necessary APIs via `contextBridge`
- [ ] Add Content Security Policy headers for the renderer
- [ ] Ensure `desktop-config.js` credential encryption uses strong crypto
- [ ] Remove or justify any `eval` / `new Function` usage
- [ ] Verify server child process spawn does not allow command injection
- [ ] Document security model in `desktop-electron/SECURITY.md`

## Acceptance criteria

- `npm run lint:security` or equivalent passes with no high-severity findings
- Code review approved by Desktop Lead
