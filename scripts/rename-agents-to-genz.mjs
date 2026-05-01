#!/usr/bin/env node
/**
 * One-off script: rename existing agents with generic role names
to cool Gen Z names.
 *
 * Run: node scripts/rename-agents-to-genz.mjs
 */
import { createDb } from "@crewspaceai/db";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const db = createDb(url);

const COOL_NAMES = [
  "Mark", "Russel", "Carl", "Liza", "Nina",
  "Milo", "Zoe", "Lexi", "Kai", "Ivy",
  "Nico", "Arlo", "Sage", "Remy", "Orion",
  "Nova", "Mae", "Finn", "Elara", "Cyrus",
];

const BORING_PATTERNS = [
  /^ceo$/i,
  /^cto$/i,
  /^ceo\s+agent$/i,
  /^engineer\s+agent$/i,
  /^backend\s+engineer$/i,
  /^software\s+engineer$/i,
  /^frontend\s+engineer$/i,
  /^full-?stack\s+engineer$/i,
  /^devops\s+engineer$/i,
  /^product\s+manager$/i,
  /^designer$/i,
  /^admin$/i,
];

function isBoring(name) {
  return BORING_PATTERNS.some((p) => p.test(name?.trim() ?? ""));
}

async function main() {
  const { agents } = await import("@crewspaceai/db");
  const { eq, inArray } = await import("drizzle-orm");

  const rows = await db.select().from(agents);
  const boring = rows.filter((a) => isBoring(a.name));

  if (boring.length === 0) {
    console.log("No boring agent names found. All good!");
    process.exit(0);
  }

  const usedNames = new Set(rows.map((a) => a.name.toLowerCase()));
  let nameIdx = 0;

  for (const agent of boring) {
    let nextName = COOL_NAMES[nameIdx % COOL_NAMES.length];
    let suffix = "";
    while (usedNames.has((nextName + suffix).toLowerCase())) {
      suffix = suffix === "" ? "2" : String(Number(suffix) + 1);
    }
    const finalName = nextName + suffix;
    usedNames.add(finalName.toLowerCase());
    nameIdx++;

    await db
      .update(agents)
      .set({ name: finalName, updatedAt: new Date() })
      .where(eq(agents.id, agent.id));

    console.log(`Renamed "${agent.name}" → "${finalName}"`);
  }

  console.log(`Done. Renamed ${boring.length} agent(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
