# Windows Code Signing — Step-by-Step Guide

## Quick Decision

| | EV Certificate | OV Certificate |
|---|---|---|
| **Cost** | ~$699/year | ~$200-300/year |
| **Setup time** | 3-5 business days | 1-3 business days |
| **User experience** | Zero warnings, instant trust | SmartScreen warns first ~100 users |
| **Best for** | Shipping to customers NOW | Budget-conscious, early beta |

**Recommendation:** Get an **EV certificate** if you plan to ship to paying customers. The $400 difference is worth avoiding support tickets from users who can't install.

---

## Step 1: Buy the Certificate

### Option A: EV Certificate (Recommended)

**Provider:** DigiCert  
**Product:** DigiCert Code Signing EV  
**Link:** https://www.digicert.com/code-signing/ev-code-signing  
**Price:** ~$699/year  
**What you get:** A USB hardware token with the private key (HSM). DigiCert mails this to you.

**Alternative (faster, no hardware token):**  
**Provider:** SSL.com  
**Product:** EV Code Signing Certificate  
**Link:** https://www.ssl.com/certificates/ev-code-signing/  
**Price:** ~$349/year  
**What you get:** Cloud-based signing via eSigner (no USB token needed). They also offer a physical token option.

### Option B: OV Certificate (Budget)

**Provider:** SSL.com  
**Product:** OV Code Signing Certificate  
**Link:** https://www.ssl.com/certificates/ov-code-signing/  
**Price:** ~$195/year (often on sale for ~$129)  
**What you get:** Cloud-based signing or downloadable certificate.

**Alternative:**  
**Provider:** Sectigo  
**Product:** Sectigo Code Signing OV  
**Link:** https://sectigo.com/ssl-certificates-tls/code-signing  
**Price:** ~$200/year

---

## Step 2: Complete Validation

After purchase, the CA validates your identity:

1. **Organization validation** — Business license, DUNS number, or articles of incorporation
2. **Phone verification** — CA calls a public phone number for your business
3. **Domain/email verification** — Confirm you own the domain/company email

**Tip:** Use SSL.com if you want the fastest turnaround (often same-day for OV, 1-2 days for EV).

---

## Step 3: Export as .pfx

### For SSL.com (Cloud/eSigner):
1. Log into your SSL.com account
2. Go to **Orders** → **Code Signing**
3. Click **Download Certificate**
4. Choose **PKCS #12 (.pfx)** format
5. Set a strong password — this becomes your `WIN_CSC_KEY_PASSWORD`
6. Save the file as `crewspace-windows.pfx`

### For DigiCert (USB token):
1. Install the SafeNet authentication client software
2. Insert the USB token
3. Open **Certificate Manager** (`certmgr.msc`)
4. Find the certificate under **Personal** → **Certificates**
5. Right-click → **All Tasks** → **Export**
6. Select **Yes, export the private key**
7. Select **PKCS #12 (.PFX)**
8. Check **Include all certificates in the certification path**
9. Set a strong password — this becomes your `WIN_CSC_KEY_PASSWORD`
10. Save as `crewspace-windows.pfx`

---

## Step 4: Base64-encode the .pfx

### Windows (PowerShell):
```powershell
[Convert]::ToBase64String((Get-Content -Path "crewspace-windows.pfx" -Encoding Byte)) | Set-Clipboard
```
This copies the base64 string to your clipboard.

### macOS/Linux:
```bash
base64 -i crewspace-windows.pfx | pbcopy
```

---

## Step 5: Add GitHub Secrets

1. Go to https://github.com/priyansh19/CrewSpace/settings/secrets/actions
2. Click **New repository secret**
3. Add:
   - **Name:** `WIN_CSC_LINK`
   - **Value:** Paste the base64 string from Step 4
4. Click **Add secret**
5. Click **New repository secret** again
6. Add:
   - **Name:** `WIN_CSC_KEY_PASSWORD`
   - **Value:** The password you set when exporting the `.pfx`
7. Click **Add secret**

Done. The CI workflow already reads these secrets — no code changes needed.

---

## Step 6: Trigger a Signed Build

### Option A: Push a new tag (recommended for release)
```bash
git tag v1.0.23
git push origin v1.0.23
```

### Option B: Manually trigger workflow
1. Go to https://github.com/priyansh19/CrewSpace/actions/workflows/release-desktop.yml
2. Click **Run workflow**
3. Select branch `main`
4. Enter version `v1.0.23`
5. Click **Run workflow**

---

## Step 7: Verify the Signature

After the build completes (~12 minutes):

1. Download `CrewSpace-Installer-1.0.23.exe` from the release
2. Right-click → **Properties** → **Digital Signatures** tab
3. You should see your company name listed
4. Or run in PowerShell:
   ```powershell
   Get-AuthenticodeSignature "CrewSpace-Installer-1.0.23.exe"
   ```
   Expected: `Status: Valid`

---

## Step 8: Submit to Microsoft for Reputation (OV only)

If you bought **OV** (not EV), submit the signed file to Microsoft to speed up reputation building:

1. Go to https://www.microsoft.com/en-us/wdsi/filesubmission
2. Sign in with a Microsoft account
3. Click **Submit a file**
4. Upload the signed `CrewSpace-Installer-*.exe`
5. **Submission type:** Software developer
6. **Product name:** CrewSpace
7. **What does this file do?** "Desktop application installer for CrewSpace, an AI agent orchestration platform."
8. Submit

Microsoft typically reviews within 24-48 hours. This tells their systems the file is legitimate and reduces SmartScreen warnings.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `No certificates were found` in CI | Wrong `WIN_CSC_KEY_PASSWORD` — re-export `.pfx` with correct password |
| `The certificate is expired` | Renew with CA and update `WIN_CSC_LINK` secret |
| `Invalid certificate file` | Re-encode `.pfx` to base64, ensure no newlines in the secret |
| SmartScreen still warns (OV cert) | Normal for first installs — submit to Microsoft (Step 8) and wait for reputation |
| CI doesn't sign | Check that `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` are in **Repository secrets**, not Environment secrets |

---

## Total Cost & Timeline

| | EV (DigiCert) | EV (SSL.com) | OV (SSL.com) |
|---|---|---|---|
| **Cost** | $699/yr | $349/yr | $129-195/yr |
| **Time to first signed build** | 3-5 days | 1-2 days | Same day |
| **User sees warning?** | Never | Never | First ~100 installs |
| **Hardware token?** | Yes (USB) | Optional | No |

---

## Next Action

**If you want to ship this week:** Buy SSL.com EV ($349) — fastest path to zero warnings.  
**If you're still in private beta:** Buy SSL.com OV ($129) — fine for early users, upgrade to EV later.

Once you have the `.pfx` file, Steps 4-6 take **5 minutes**.
