# macOS Code Signing & Notarization Setup

This document explains how to configure Apple Developer credentials so that CrewSpace Desktop builds are **signed and notarized**, eliminating the Gatekeeper "can't verify" warning on macOS.

---

## Prerequisites

1. **Apple Developer Account** ($99/year) — enroll at [developer.apple.com](https://developer.apple.com)
2. **Apple Developer ID Application certificate** (for signing the `.app` bundle)
3. **Apple Developer ID Installer certificate** (optional, for `.pkg` builds)
4. **App-Specific Password** — generate at [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords
5. **Team ID** — found in Apple Developer portal under Membership details

---

## Step 1: Generate Certificates

1. Go to [Apple Developer Certificates](https://developer.apple.com/account/resources/certificates/list)
2. Click **+** → **Developer ID Application** → follow instructions to create a Certificate Signing Request (CSR) from Keychain Access
3. Download the certificate and double-click to install it into your **login** keychain
4. Repeat for **Developer ID Installer** (if you plan to build `.pkg` installers)
5. Find the installed certificate in Keychain Access, right-click the **private key** → **Export** as `.p12`
6. Set a strong password when exporting — you'll need this as `CSC_KEY_PASSWORD`

---

## Step 2: Base64-encode the Certificate

Convert your `.p12` file to base64 so it can be stored as a GitHub secret:

```bash
base64 -i ~/path/to/your/certificate.p12 -o ~/certificate-base64.txt
```

On Windows (Git Bash / WSL):
```bash
base64 -w 0 ~/path/to/your/certificate.p12 > ~/certificate-base64.txt
```

Copy the contents of `certificate-base64.txt` — this is your `CSC_LINK` secret.

---

## Step 3: Add GitHub Repository Secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these 5 secrets:

| Secret Name | Value |
|---|---|
| `CSC_LINK` | Base64-encoded `.p12` certificate contents |
| `CSC_KEY_PASSWORD` | The password you set when exporting the `.p12` |
| `APPLE_ID` | Your Apple ID email (e.g. `you@example.com`) |
| `APPLE_APP_SPECIFIC_PASSWORD` | The app-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | Your Apple Developer Team ID (10 characters, e.g. `ABCDE12345`) |

---

## Step 4: Build Signed DMG

Once secrets are configured, the next CI run on this branch will automatically:

1. Sign the `.app` bundle with your Developer ID Application certificate
2. Notarize the app with Apple
3. Staple the notarization ticket to the app
4. Build the DMG with the signed app

To trigger a build manually:
- Go to **Actions** → **Release Desktop** → **Run workflow**
- Select this branch (`feat/macos-signing-notarize`)
- Or push a tag like `v1.0.18` to auto-trigger

---

## Step 5: Verify on a Clean Mac

After downloading the DMG from the release:

1. Open the DMG, drag CrewSpace to Applications
2. **Double-click to launch** — Gatekeeper should allow it without warnings
3. Run this to confirm notarization:
   ```bash
   spctl -a -vv /Applications/CrewSpace.app
   ```
   Expected output:
   ```
   /Applications/CrewSpace.app: accepted
   source=Notarized Developer ID
   origin=Developer ID Application: Your Name (TEAMID)
   ```

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `No identities were found` | Certificate not installed or expired | Re-export `.p12` and update `CSC_LINK` secret |
| `Authentication failed` | Wrong app-specific password | Generate a new one at appleid.apple.com |
| `Invalid team ID` | Wrong `APPLE_TEAM_ID` | Copy exact 10-char ID from Developer Portal |
| Notarization timeout | Apple servers slow | Re-run the workflow; notarization is async |
| `The binary is not signed` | Missing hardened runtime entitlements | Ensure `entitlements.mac.plist` is committed |

---

## Files Changed for Signing

- `desktop-electron/build/entitlements.mac.plist` — hardened runtime entitlements
- `desktop-electron/build/entitlements.mac.inherit.plist` — child process entitlements
- `desktop-electron/scripts/afterSign.cjs` — notarization hook
- `desktop-electron/package.json` — mac build config (removed `identity: null`)
- `.github/workflows/release-desktop.yml` — CI env vars for signing
- `desktop-electron/package.json` — added `@electron/notarize` dependency
