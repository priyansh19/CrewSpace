import postgres from '/app/node_modules/.pnpm/postgres@3.4.8/node_modules/postgres/src/index.js';
const sql = postgres('postgres://crewspace:crewspace@localhost:54329/crewspace');
const rows = await sql`SELECT id, name FROM agents`;
const boring = rows.filter(a => /^(ceo|cto|backend engineer|software engineer|engineer|frontend engineer|full-?stack engineer|devops engineer|product manager|designer|admin|ceo agent|engineer agent)$/i.test(a.name.trim()));

const cool = ['Mark','Russel','Carl','Liza','Nina','Jake','Milo','Zoe','Lexi','Kai','Ivy','Nico','Arlo','Sage','Remy','Orion','Nova','Mae','Finn','Elara'];
const used = new Set(rows.map(a => a.name.toLowerCase()));
let i = 0;
for (const a of boring) {
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
