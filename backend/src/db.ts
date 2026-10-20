import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load backend/.env before the pool is created (this module is imported early).
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const { Pool, types, defaults } = pg;

// `timestamp` columns hold UTC, but pg parses them as local time by default.
types.setTypeParser(types.builtins.TIMESTAMP, (value: string) => new Date(`${value.replace(' ', 'T')}Z`));

// Send JS Dates as UTC. PostgreSQL drops any offset when storing into `timestamp`,
// so a local-time value would be stored shifted.
defaults.parseInputDatesAsUTC = true;

// bigint (report_id) is left as a string: xxhash64 values exceed Number.MAX_SAFE_INTEGER.

// For a database with a private or self-signed certificate, point DATABASE_SSL_CA at its CA
// certificate. The connection is then encrypted and the server's certificate is verified;
// never turn verification off (rejectUnauthorized: false / NODE_TLS_REJECT_UNAUTHORIZED=0).
const sslCaPath = process.env.DATABASE_SSL_CA?.trim();

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX) || 10,
  connectionTimeoutMillis: Number(process.env.DB_TIMEOUT_MS) || 5000,
  ...(sslCaPath ? { ssl: { ca: readFileSync(sslCaPath, 'utf8'), rejectUnauthorized: true } } : {}),
});
