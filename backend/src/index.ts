import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { db } from './db.js';
import simulationsRouter from './routes/simulations.router.js';
import { ApiError } from './services/api-error.js';

const databaseConnectionErrorCodes = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'EPIPE',
  '28P01',
  '28000',
  '3D000',
]);

function isDatabaseConnectionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  const code = error.code;
  return typeof code === 'string' && (code.startsWith('08') || databaseConnectionErrorCodes.has(code));
}

function logDatabaseError(context: string, error: unknown): void {
  const code = typeof error === 'object' && error !== null && 'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : undefined;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${context}:`, { code, message });
}

function getRequestBodyError(error: unknown): { status: number; message: string } | undefined {
  if (typeof error !== 'object' || error === null || !('type' in error)) return undefined;

  switch (error.type) {
    case 'entity.parse.failed':
      return { status: 400, message: 'Invalid JSON request body.' };
    case 'entity.too.large':
      return { status: 413, message: 'Request body too large.' };
    case 'charset.unsupported':
    case 'encoding.unsupported':
      return { status: 415, message: 'Unsupported request body encoding.' };
    case 'request.aborted':
    case 'request.size.invalid':
      return { status: 400, message: 'Invalid request body.' };
    default:
      return undefined;
  }
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use('/api/simulations', simulationsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get('/health/ready', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ready', database: 'connected' });
  } catch (error) {
    logDatabaseError('PostgreSQL readiness check failed', error);
    res.status(503).json({ status: 'not_ready', database: 'unavailable' });
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const requestBodyError = getRequestBodyError(error);
  if (requestBodyError) {
    res.status(requestBodyError.status).json({ error: requestBodyError.message });
    return;
  }

  const databaseUnavailable = isDatabaseConnectionError(error);
  const statusCode = error instanceof ApiError ? error.statusCode : databaseUnavailable ? 503 : 500;
  const message = error instanceof ApiError
    ? error.message
    : databaseUnavailable
      ? 'Database unavailable. Check backend logs and /health/ready.'
      : 'Internal server error.';

  if (statusCode === 500) console.error('API request failed:', error);
  if (databaseUnavailable) logDatabaseError('Database request failed', error);
  res.status(statusCode).json({ error: message });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  void db.query('SELECT 1')
    .then(() => console.log('PostgreSQL connection established'))
    .catch((error: unknown) => logDatabaseError('PostgreSQL startup connection failed', error));
});
