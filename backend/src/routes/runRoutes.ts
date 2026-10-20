import { Router } from 'express';
import { asyncHandler, validateParams, vUuid } from '../lib/validate.js';
import type { Scheduler } from '../scheduler/index.js';

/** Mounted at /api/simulations/:simulationId/runs. */
export function createRunRoutes(scheduler: Scheduler) {
  const runRoutes = Router({ mergeParams: true });

  // 409 if the simulation already has a started run.
  runRoutes.post('/',
    validateParams({ simulationId: vUuid() }),
    asyncHandler(async (req, res) => {
      const { simulationId } = req.validatedParams as { simulationId: string };
      res.status(201).json(await scheduler.startRun(simulationId));
    }),
  );

  runRoutes.get('/:runId',
    validateParams({ simulationId: vUuid(), runId: vUuid() }),
    asyncHandler(async (req, res) => {
      const { simulationId, runId } = req.validatedParams as { simulationId: string; runId: string };
      res.json(await scheduler.getRun(simulationId, runId));
    }),
  );

  // 409 if the run is no longer started.
  runRoutes.post('/:runId/stop',
    validateParams({ simulationId: vUuid(), runId: vUuid() }),
    asyncHandler(async (req, res) => {
      const { simulationId, runId } = req.validatedParams as { simulationId: string; runId: string };
      res.json(await scheduler.stopRun(simulationId, runId));
    }),
  );

  return runRoutes;
}
