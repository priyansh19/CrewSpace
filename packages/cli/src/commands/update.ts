import { getCliVersion } from "../utils/version.js";

export async function updateCommand(): Promise<void> {
  const current = getCliVersion();
  console.log(`Current version: v${current}`);
  console.log("Checking npm for latest version...");

  try {
    const res = await fetch("https://registry.npmjs.org/crewspace/latest");
    const data = await res.json() as { version: string };
    const latest = data.version;

    if (latest === current) {
      console.log("You are on the latest version.");
    } else {
      console.log(`\nNew version available: v${latest}`);
      console.log("Run: npm install -g crewspace");
    }
  } catch {
    console.error("Could not reach npm registry. Check your internet connection.");
    process.exit(1);
  }
}
