import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { findAvailablePort } from "../utils/port.js";
import { getCliVersion } from "../utils/version.js";

export async function doctorCommand(): Promise<void> {
  const checks: Array<{ label: string; ok: boolean; detail?: string }> = [];

  const nodeVer = process.versions.node;
  const [nodeMajor] = nodeVer.split(".").map(Number);
  checks.push({
    label: "Node.js >= 20",
    ok: nodeMajor >= 20,
    detail: `v${nodeVer}`,
  });

  const availablePort = await findAvailablePort(3100);
  checks.push({
    label: "Port 3100 available",
    ok: availablePort === 3100,
    detail: availablePort !== 3100 ? `port 3100 in use, would use ${availablePort}` : "free",
  });

  const dataDir = join(homedir(), ".crewspace");
  checks.push({
    label: "Data directory (~/.crewspace)",
    ok: true,
    detail: existsSync(dataDir) ? "exists" : "will be created on first start",
  });

  checks.push({
    label: "CrewSpace version",
    ok: true,
    detail: `v${getCliVersion()}`,
  });

  console.log("\nCrewSpace Doctor\n");
  for (const check of checks) {
    const icon = check.ok ? "✓" : "✗";
    const detail = check.detail ? ` (${check.detail})` : "";
    console.log(`  ${icon} ${check.label}${detail}`);
  }

  const failed = checks.filter((c) => !c.ok);
  if (failed.length > 0) {
    console.log(`\n${failed.length} check(s) failed.`);
    process.exit(1);
  } else {
    console.log("\nAll checks passed.");
  }
}
