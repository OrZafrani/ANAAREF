import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import morgan from 'morgan';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiErrorHandler } from './lib/validate.js';
import { categoryRoutes, subCategoryRoutes } from './routes/categoryRoutes.js';
import { libraryRoutes } from './routes/libraryRoutes.js';
import { templateRoutes } from './routes/templateRoutes.js';
import { isLibraryEmpty, runSeedLibrary } from './seed/categorySeedLoader.js';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use('/api/categories', categoryRoutes);
app.use('/api/sub-categories', subCategoryRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/templates', templateRoutes);
app.use(apiErrorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
  console.log(`Backend running on http://localhost:${PORT}`);

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
