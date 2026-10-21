import dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });
const url = new URL(process.env.DATABASE_URL!);
url.port = '5432';
process.env.DATABASE_URL = url.toString();
const { db } = await import('./db.js');

try {
  await db.query('SELECT 1');
  console.log('Database connection succeeded on configured host port 5432.');
} catch (error) {
  const code = typeof error === 'object' && error !== null && 'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : 'no SQLSTATE or network code';
  console.error('Database connection failed on port 5432:', code);
  process.exitCode = 1;
} finally {
  await db.end();
}
