// node-pg-migrate runner with SSL support for self-signed cloud certs.
// Usage: node ./migrate.cjs up | node ./migrate.cjs down
const { config } = require('dotenv');
const path = require('node:path');

config({ path: path.join(__dirname, '.env') });

const raw = process.env.DATABASE_URL || '';
const cleanUrl = raw.replace('?sslmode=require', '').replace('?sslmode=disable', '').split('?')[0];
const needsSsl = /sslmode=require/i.test(raw) || /:15432\//.test(raw);

process.env.DATABASE_URL = cleanUrl;

const runner = require('node-pg-migrate');
const run = runner.runner || runner.default || runner;

const direction = process.argv[2] === 'down' ? 'down' : 'up';

run({
  databaseUrl: {
    connectionString: cleanUrl,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  },
  dir: 'migrations',
  direction,
  migrationsTable: 'pgmigrations',
  verbose: true,
}).then(() => {
  console.log(`Migrations ${direction} complete.`);
}).catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
