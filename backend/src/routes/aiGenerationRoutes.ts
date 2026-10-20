import { Router } from 'express';
import { getGeneration, startGeneration } from '../services/ai-generation.service.js';

export const aiGenerationRoutes = Router();

aiGenerationRoutes.post('/', async (req, res, next) => {
  try {
    res.status(202).json(await startGeneration(req.body));
  } catch (error) { next(error); }
});

aiGenerationRoutes.get('/:runId', async (req, res, next) => {
  try {
    res.json(await getGeneration(req.params.runId));
  } catch (error) { next(error); }
});
