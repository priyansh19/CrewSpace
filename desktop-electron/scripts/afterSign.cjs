// Runs after electron-builder signs (or skips signing) the app bundle,
// before DMG is created. Strips any ad-hoc signature so macOS shows
// "unidentified developer" instead of the harder "damaged" Gatekeeper error.
const { execSync } = require("child_process");
const path = require("path");

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );

  console.log(`[afterSign] Stripping ad-hoc signature from: ${appPath}`);
  try {
    execSync(`codesign --remove-signature --deep "${appPath}"`, {
      stdio: "inherit",
    });
    console.log("[afterSign] Signature removed — app will be unsigned.");
  } catch (e) {
    console.warn("[afterSign] codesign remove-signature failed:", e.message);
  }
};
