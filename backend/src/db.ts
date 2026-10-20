import 'dotenv/config';
import pg from 'pg';
import dotenv from 'dotenv';
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

function sanitizeConnectionString(raw: string): { connectionString: string; ssl: { rejectUnauthorized: false } | undefined } {
  // The local .env may contain libpq/ODBC-style query params
  // (e.g. ?sslmode=disable&uselibpqcompat=true) which node-pg only partly understands.
  // Normalize them: drop ODBC-only flags, and translate sslmode into a pg `ssl` option
  // (self-signed cloud certs need rejectUnauthorized:false).
  try {
    const url = new URL(raw);
    url.searchParams.delete('uselibpqcompat');
    const sslmode = (url.searchParams.get('sslmode') ?? '').toLowerCase();
    url.searchParams.delete('sslmode');
    // Drop any other unknown params that node-pg would treat as config.
    const supported = new Set([
      'host', 'port', 'dbname', 'user', 'password',
      'connectionTimeoutMillis', 'idleTimeoutMillis', 'max',
      'ssl', 'application_name',
    ]);
    for (const key of [...url.searchParams.keys()]) {
      if (!supported.has(key)) url.searchParams.delete(key);
    }
    const needsSsl = sslmode === 'require' || sslmode === 'prefer' ||
      sslmode === 'verify-ca' || sslmode === 'verify-full' ||
      url.port === '15432';
    return {
      connectionString: url.toString(),
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    };
  } catch {
    return { connectionString: raw, ssl: undefined };
  }
}

const rawConnectionString = process.env.DATABASE_URL;
if (!rawConnectionString) {
  throw new Error('DATABASE_URL is required. Set it in backend/.env before starting the API.');
}

const { connectionString, ssl } = sanitizeConnectionString(rawConnectionString);

export const db = new Pool({
  connectionString,
  ...(ssl ? { ssl } : {}),
  max: Number(process.env.DB_POOL_MAX) || 10,
  connectionTimeoutMillis: Number(process.env.DB_TIMEOUT_MS) || 5000,
});

db.on('error', (error: Error & { code?: string }) => {
  console.error('Unexpected PostgreSQL pool error:', {
    code: error.code,
    message: error.message,
  });
});

