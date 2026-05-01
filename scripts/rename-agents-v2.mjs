import postgres from '/app/node_modules/.pnpm/postgres@3.4.8/node_modules/postgres/src/index.js';
const sql = postgres('postgres://crewspace:crewspace@localhost:54329/crewspace');
const rows = await sql`SELECT id, name FROM agents ORDER BY name`;

// Broader pattern: any name that looks like a job title / role label
const BORING_RE = /\b(engineer|manager|designer|admin|officer|test|qa|full-?stack|frontend|backend|devops|product|senior|junior|lead|principal|staff|intern)\b/i;
const EXACT_BORING = /^(ceo|cto|cfo|coo|vp|director|head)$/i;

const cool = ['Mark','Russel','Carl','Liza','Nina','Jake','Milo','Zoe','Lexi','Kai','Ivy','Nico','Arlo','Sage','Remy','Orion','Nova','Mae','Finn','Elara','Cyrus','Wren','Theo','Luna','Jett','Reese','Cade','Dahlia','Koa','Sienna','Atlas','Iris','Phoenix','Juno','Ezra','Cleo','Rowan','Aria','Silas','Tessa'];
const used = new Set(rows.map(a => a.name.toLowerCase()));

let i = 0;
for (const a of rows) {
  const isBoring = BORING_RE.test(a.name) || EXACT_BORING.test(a.name);
  const alreadyCool = cool.some(n => n.toLowerCase() === a.name.toLowerCase());
  if (!isBoring || alreadyCool) continue;

  let name = cool[i % cool.length];
  let suffix = '';
  while (used.has((name + suffix).toLowerCase())) {
    suffix = suffix === '' ? '2' : String(Number(suffix) + 1);
  }
  const final = name + suffix;
  used.add(final.toLowerCase());
  await sql`UPDATE agents SET name = ${final}, updated_at = NOW() WHERE id = ${a.id}`;
  console.log('Renamed ' + a.name + ' -> ' + final);
  i++;
}
console.log('Done');
await sql.end();
