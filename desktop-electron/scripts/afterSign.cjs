// Runs after electron-builder signs the app bundle.
// Notarizes the app with Apple for Gatekeeper compliance.
const { notarize } = require("@electron/notarize");
const path = require("path");

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== "darwin") {
    console.log("[afterSign] Skipping notarization — not macOS.");
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.warn(
      "[afterSign] Missing Apple signing credentials — skipping notarization.\n" +
      "Set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID env vars."
    );
    return;
  }

  console.log(`[afterSign] Notarizing: ${appPath}`);
  try {
    await notarize({
      appBundleId: "com.crewspaceai.desktop",
      appPath,
      appleId,
      appleIdPassword,
      teamId,
    });
    console.log("[afterSign] Notarization complete.");
  } catch (e) {
    console.error("[afterSign] Notarization failed:", e.message);
    throw e;
  }
};
