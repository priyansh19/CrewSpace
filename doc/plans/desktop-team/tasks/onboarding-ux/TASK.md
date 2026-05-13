---
name: Redesign onboarding for desktop-native UX
project: desktop-app
assignee: desktop-ui
---

# Redesign onboarding for desktop-native UX

Improve the first-run experience so new users understand that CrewSpace Desktop is a self-contained local server, not just a web wrapper.

## Checklist

- [ ] Clarify copy: explain embedded server, offline capability, and LAN sharing
- [ ] Add animated demo or screenshot carousel of desktop-specific features
- [ ] Streamline theme selection (default to OS preference)
- [ ] Make service connections optional and skippable without friction
- [ ] Add "Open on system startup" toggle
- [ ] Ensure onboarding is keyboard-navigable
- [ ] Test at 1280×720 and 1920×1080 resolutions

## Acceptance criteria

- Onboarding completion rate > 80% in smoke tests
- No scrollbars or clipped content on standard resolutions
- Theme correctly syncs with OS setting by default
