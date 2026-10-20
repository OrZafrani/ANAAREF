import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import morgan from 'morgan';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { db } from './db.js';
import { reportPublisher } from './kafka.js';
import { apiErrorHandler } from './lib/validate.js';
import { categoryRoutes, subCategoryRoutes } from './routes/categoryRoutes.js';
import { libraryRoutes } from './routes/libraryRoutes.js';
import simulationsRouter from './routes/simulations.router.js';
import { createRunRoutes } from './routes/runRoutes.js';
import { templateRoutes } from './routes/templateRoutes.js';
import { createScheduler } from './scheduler/index.js';
import { systemClock } from './scheduler/clock.js';
import { runRepository } from './scheduler/runRepository.js';
import { isLibraryEmpty, runSeedLibrary } from './seed/categorySeedLoader.js';
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

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use('/api/simulations', simulationsRouter);
app.use('/api/categories', categoryRoutes);
app.use('/api/sub-categories', subCategoryRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/templates', templateRoutes);

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

const scheduler = createScheduler({
  store: runRepository,
  publisher: reportPublisher,
  clock: systemClock,
  ...config.scheduler,
});
app.use('/api/simulations/:simulationId/runs', createRunRoutes(scheduler));

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestBodyError = getRequestBodyError(error);
  if (requestBodyError) {
    res.status(requestBodyError.status).json({ error: requestBodyError.message });
    return;
  }

  const databaseUnavailable = isDatabaseConnectionError(error);
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (databaseUnavailable) {
    logDatabaseError('Database request failed', error);
    res.status(503).json({ error: 'Database unavailable. Check backend logs and /health/ready.' });
    return;
  }

  next(error);
});

app.use(apiErrorHandler);

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, async () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  void db.query('SELECT 1')
    .then(() => console.log('PostgreSQL connection established'))
    .catch((error: unknown) => logDatabaseError('PostgreSQL startup connection failed', error));

  // Resume simulation runs that were dispatching when the backend last stopped.
  try {
    await scheduler.recoverRuns();
  } catch (err) {
    console.error('[boot] Run recovery failed (non-fatal):', err);
  }

  // Auto-seed: populate the template library if it is empty
  try {
    if (await isLibraryEmpty()) {
      console.log('[boot] Library is empty – running auto-seed...');
      await runSeedLibrary();
    } else {
      console.log('[boot] Library already populated – skipping seed.');
    }
  } catch (err) {
    console.error('[boot] Auto-seed failed (non-fatal):', err);
  }
});

// Started runs stay started, so the next boot resumes them.
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received, stopping`);
  server.close();
  try {
    await scheduler.shutdown();
    await reportPublisher.disconnect();
    await db.end();
  } catch (err) {
    console.error('[shutdown] Error while stopping:', err);
  }
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
