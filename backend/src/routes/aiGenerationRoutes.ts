import { Router } from 'express';
import { config } from '../config.js';
import { rateLimit } from '../lib/rateLimit.js';
import { aiGenerationRateLimitStore } from '../services/aiGenerationRateLimitStore.js';
import { getGeneration, startGeneration } from '../services/ai-generation.service.js';

export const aiGenerationRoutes = Router();

const { rateLimit: limit, rateWindowS: windowS } = config.aiGeneration;

// Generating uses many AI tokens. Polling a generation (GET) isn't limited.
const generationRateLimit = rateLimit({
  store: aiGenerationRateLimitStore,
  limit,
  windowS,
  message: (retryAfterS) =>
    `You can start up to ${limit} AI generations every ${windowS} seconds. Try again in ${retryAfterS} seconds.`,
});

aiGenerationRoutes.post('/', generationRateLimit, async (req, res, next) => {
  try {
    res.status(202).json(await startGeneration(req.body));
  } catch (error) { next(error); }
});

aiGenerationRoutes.get('/:runId', async (req, res, next) => {
  try {
    res.json(await getGeneration(req.params.runId));
  } catch (error) { next(error); }
});
