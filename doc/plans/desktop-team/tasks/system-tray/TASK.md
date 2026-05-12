---
name: Add system tray status and quick actions
project: desktop-app
assignee: desktop-ui
---

# Add system tray status and quick actions

Make the system tray a first-class control surface for CrewSpace Desktop.

## Checklist

- [ ] Show server status icon (running / starting / error / paused)
- [ ] Add tooltip with current port and LAN URL
- [ ] Quick actions: Open App, Copy LAN URL, Restart Server, Pause/Resume
- [ ] Add native notification when server fails to start or crashes
- [ ] Minimize-to-tray behavior (close hides to tray, quit exits)
- [ ] macOS menu bar vs Windows system tray parity

## Acceptance criteria

- Tray icon reflects server state within 2 seconds of change
- All quick actions work without opening the main window
- Notifications use native OS APIs, not HTML5 notifications
- App does not fully quit on window close (minimizes to tray)
