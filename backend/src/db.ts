import 'dotenv/config';
import pg from 'pg';

const { Pool, types, defaults } = pg;

// `timestamp` columns hold UTC, but pg parses them as local time by default.
types.setTypeParser(types.builtins.TIMESTAMP, (value: string) => new Date(`${value.replace(' ', 'T')}Z`));

// Send JS Dates as UTC. PostgreSQL drops any offset when storing into `timestamp`,
// so a local-time value would be stored shifted.
defaults.parseInputDatesAsUTC = true;

// bigint (report_id) is left as a string: xxhash64 values exceed Number.MAX_SAFE_INTEGER.

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required. Set it in backend/.env before starting the API.');
}

export const db = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX) || 10,
  connectionTimeoutMillis: Number(process.env.DB_TIMEOUT_MS) || 5000,
});

db.on('error', (error: Error & { code?: string }) => {
  console.error('Unexpected PostgreSQL pool error:', {
    code: error.code,
    message: error.message,
  });
});
