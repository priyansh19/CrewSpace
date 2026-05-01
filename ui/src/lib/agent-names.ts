// Cool Gen Z / modern agent name pool
// Used as default suggestions when creating new agents

const AGENT_NAMES = [
  "Mark", "Russel", "Carl", "Liza", "Nina",
  "Jake", "Milo", "Zoe", "Lexi", "Kai",
  "Ivy", "Nico", "Arlo", "Sage", "Remy",
  "Orion", "Nova", "Mae", "Finn", "Elara",
  "Cyrus", "Wren", "Theo", "Luna", "Jett",
  "Reese", "Cade", "Dahlia", "Koa", "Sienna",
  "Atlas", "Iris", "Phoenix", "Juno", "Ezra",
  "Cleo", "Rowan", "Aria", "Silas", "Tessa",
];

const CEO_NAMES = ["Mark", "Russel", "Jake", "Orion", "Atlas", "Cyrus", "Nico", "Phoenix"];

/** Pick a random name from the pool, optionally excluding used names. */
export function suggestAgentName(usedNames: string[] = [], isFirst = false): string {
  const pool = isFirst ? CEO_NAMES : AGENT_NAMES;
  const available = pool.filter((n) => !usedNames.some((u) => u.toLowerCase() === n.toLowerCase()));
  if (available.length === 0) {
    // fallback: append a number
    const base = pool[Math.floor(Math.random() * pool.length)];
    let i = 2;
    while (usedNames.some((u) => u.toLowerCase() === `${base}${i}`.toLowerCase())) {
      i++;
    }
    return `${base}${i}`;
  }
  return available[Math.floor(Math.random() * available.length)];
}
