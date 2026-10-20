import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import morgan from 'morgan';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { db } from './db.js';
import { reportPublisher } from './kafka.js';
import { corsOptions, requireJsonForWrites, securityHeaders, writeRateLimit } from './lib/security.js';
import { apiErrorHandler } from './lib/validate.js';
import { categoryRoutes, subCategoryRoutes } from './routes/categoryRoutes.js';
import { libraryRoutes } from './routes/libraryRoutes.js';
import { createRunRoutes } from './routes/runRoutes.js';
import { templateRoutes } from './routes/templateRoutes.js';
import { createScheduler } from './scheduler/index.js';
import { systemClock } from './scheduler/clock.js';
import { runRepository } from './scheduler/runRepository.js';
import { isLibraryEmpty, runSeedLibrary } from './seed/categorySeedLoader.js';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
  console.warn('[security] NODE_TLS_REJECT_UNAUTHORIZED=0 turns off TLS certificate checks for every outgoing connection. '
    + 'Remove it and set DATABASE_SSL_CA instead (see backend/.env.example).');
}

const app = express();
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(cors(corsOptions(config.http.corsOrigins)));
app.use(express.json({ limit: config.http.jsonBodyLimit }));
app.use(morgan('dev'));
app.use('/api', writeRateLimit({ max: config.http.writeRateLimitPerMin, windowMs: 60_000 }));
app.use('/api', requireJsonForWrites);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use('/api/categories', categoryRoutes);
app.use('/api/sub-categories', subCategoryRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/templates', templateRoutes);

const scheduler = createScheduler({
  store: runRepository,
  publisher: reportPublisher,
  clock: systemClock,
  ...config.scheduler,
});
app.use('/api/simulations/:simulationId/runs', createRunRoutes(scheduler));

app.use(apiErrorHandler);

const { host, port } = config.http;
const server = app.listen(port, host, async () => {
  console.log(`Backend running on http://${host}:${port}`);

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
