# Windows Code Signing Setup

This document explains how to configure code signing so CrewSpace Desktop builds bypass Windows Smart App Control / SmartScreen warnings.

---

## Problem

Without a code signature, Windows 11 **Smart App Control** blocks the installer:

> "CrewSpace Setup was blocked by Smart App Control policy"

Windows 10/11 **SmartScreen** also shows:

> "Windows protected your PC - Microsoft Defender SmartScreen prevented an unrecognized app from starting"

## Solution Options

### Option A: Traditional OV Code Signing Certificate (Recommended for now)

**Cost:** ~$200-400/year  
**Providers:** DigiCert, Sectigo, SSL.com, GoGetSSL  
**Validation:** Organization Validation (OV) — requires business registration docs

**Steps:**
1. Purchase an **OV Code Signing Certificate** from a CA
2. Complete organization validation (business license, phone verification, etc.)
3. Download the certificate as a `.pfx` file (or export from Windows Certificate Store)
4. Base64-encode the `.pfx`:
   ```powershell
   [Convert]::ToBase64String((Get-Content -Path "C:\path\to\certificate.pfx" -Encoding Byte)) | Set-Content -Path "C:\path\to\certificate-base64.txt"
   ```
5. Add GitHub secrets (see Step 2 below)

### Option B: Azure Trusted Signing (Future / Cheaper)

**Cost:** ~$10/month subscription + per-sign fee  
**Requires:** Azure subscription, Azure AD tenant  
**Pros:** No physical certificate file, cloud-based, faster reputation building  
**Cons:** Newer service, requires Azure setup

**Steps:**
1. Create an Azure Trusted Signing account: https://azure.microsoft.com/products/trusted-signing
2. Create a signing profile and identity
3. Configure CI to use the Azure Trusted Signing CLI instead of `electron-builder`'s built-in signing

> **Note:** Azure Trusted Signing integration requires custom CI steps beyond what `electron-builder` supports natively. This is documented for future reference.

---

## Step 1: Export Certificate as .pfx

If your CA delivered the certificate in a different format:

1. Open **Certificate Manager** (`certmgr.msc`)
2. Find your code signing certificate under **Personal** → **Certificates**
3. Right-click → **All Tasks** → **Export**
4. Select **Yes, export the private key**
5. Select **PKCS #12 (.PFX)**
6. Check **Include all certificates in the certification path**
7. Set a strong password — you'll need this as `WIN_CSC_KEY_PASSWORD`
8. Save as `crewspace-windows-signing.pfx`

## Step 2: Add GitHub Repository Secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these 2 secrets:

| Secret Name | Value |
|---|---|
| `WIN_CSC_LINK` | Base64-encoded `.pfx` certificate contents (from Step 1) |
| `WIN_CSC_KEY_PASSWORD` | The password you set when exporting the `.pfx` |

**To base64-encode on Windows (PowerShell):**
```powershell
[Convert]::ToBase64String((Get-Content -Path "crewspace-windows-signing.pfx" -Encoding Byte)) | Set-Clipboard
```

**To base64-encode on macOS/Linux:**
```bash
base64 -i crewspace-windows-signing.pfx | pbcopy
```

## Step 3: Build Signed Release

Once secrets are configured, the next CI run will automatically:

1. Sign the NSIS installer (`CrewSpace-Setup-*.exe`)
2. Sign the installer wizard portable exe (`CrewSpace-Installer-*.exe`)
3. Upload signed artifacts to the GitHub Release

The CI workflow already has the signing env vars wired in:
```yaml
env:
  WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
  WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
```

## Step 4: Verify on a Clean Windows Machine

1. Download the installer from the GitHub Release
2. Double-click to run
3. Smart App Control / SmartScreen should show a normal UAC prompt instead of a block warning
4. Check digital signature:
   ```powershell
   Get-AuthenticodeSignature -Path "CrewSpace-Installer-*.exe"
   ```

## Reputation Building

Even with a valid signature, **new certificates have low reputation** and may still trigger SmartScreen for the first few hundred installs. This is normal and improves over time as Microsoft builds reputation for the certificate.

To speed up reputation building:
- Submit the signed installer to Microsoft for malware analysis: https://www.microsoft.com/en-us/wdsi/filesubmission
- Select **"Software developer"** as the submission type
- This tells Microsoft's systems that the file is legitimate

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `No certificates were found` | Wrong password or corrupted base64 | Re-export `.pfx` and update secrets |
| `The certificate is expired` | Certificate expired | Renew with CA and update secrets |
| SmartScreen still warns | Low certificate reputation | Wait for installs to build reputation, or submit to Microsoft |
| `electron-builder` skips signing | Env vars not set | Verify `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` are in repo secrets |
