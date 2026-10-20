// node-pg-migrate runner with SSL support for self-signed cloud certs.
// Usage: node ./migrate.mjs up | node ./migrate.mjs down
//
// An ES module because node-pg-migrate 9 is ESM-only: require() of it fails
// with ERR_REQUIRE_ESM on Node versions before 20.19 / 22.12.
import { config } from 'dotenv';
import { runner } from 'node-pg-migrate';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(here, '.env') });

const raw = process.env.DATABASE_URL || '';
const cleanUrl = raw.replace('?sslmode=require', '').replace('?sslmode=disable', '').split('?')[0];
const needsSsl = /sslmode=require/i.test(raw) || /:15432\//.test(raw);

process.env.DATABASE_URL = cleanUrl;

const direction = process.argv[2] === 'down' ? 'down' : 'up';

try {
  await runner({
    databaseUrl: {
      connectionString: cleanUrl,
      ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    },
    dir: 'migrations',
    direction,
    migrationsTable: 'pgmigrations',
    verbose: true,
  });
  console.log(`Migrations ${direction} complete.`);
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
}
