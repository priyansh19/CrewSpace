#!/usr/bin/env node
const command = process.argv[2]?.toLowerCase();

const commands: Record<string, () => Promise<void>> = {
  start: async () => {
    const { startCommand } = await import("./commands/start.js");
    await startCommand();
  },
};

async function main() {
  if (command === "--version" || command === "-v") {
    const { readFileSync } = await import("node:fs");
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    console.log(`crewspace v${pkg.version}`);
    process.exit(0);
  }

  if (!command || command === "--help" || command === "-h") {
    console.log(`
CrewSpace — AI agent company control plane

Usage:
  crewspace start     Start the server and open in browser
  crewspace stop      Stop the running server
  crewspace status    Show server status
  crewspace doctor    Run system health checks
  crewspace update    Check for updates
`);
    process.exit(0);
  }

  const handler = commands[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    console.error("Run 'crewspace --help' for usage.");
    process.exit(1);
  }

  await handler();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
