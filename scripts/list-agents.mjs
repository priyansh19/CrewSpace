import postgres from '/app/node_modules/.pnpm/postgres@3.4.8/node_modules/postgres/src/index.js';
const sql = postgres('postgres://crewspace:crewspace@localhost:54329/crewspace');
const rows = await sql`SELECT id, name, role, title FROM agents ORDER BY name`;
console.log(JSON.stringify(rows, null, 2));
await sql.end();
