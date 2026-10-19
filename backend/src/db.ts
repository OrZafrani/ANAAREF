import pg from 'pg';

const { Pool, types, defaults } = pg;

// `timestamp` columns hold UTC, but pg parses them as local time by default.
types.setTypeParser(types.builtins.TIMESTAMP, (value: string) => new Date(`${value.replace(' ', 'T')}Z`));

// Send JS Dates as UTC. PostgreSQL drops any offset when storing into `timestamp`,
// so a local-time value would be stored shifted.
defaults.parseInputDatesAsUTC = true;

// bigint (report_id) is left as a string: xxhash64 values exceed Number.MAX_SAFE_INTEGER.

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX) || 10,
  connectionTimeoutMillis: Number(process.env.DB_TIMEOUT_MS) || 5000,
  // Lets queries use `reports` instead of `cobra.reports`.
  options: '-c search_path=cobra',
});
