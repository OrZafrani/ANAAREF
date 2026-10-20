import { Router } from 'express';
import { asyncHandler, validateBody, validateParams, vUuid } from '../lib/validate.js';
import type { Scheduler } from '../scheduler/index.js';

/** Mounted at /api/simulations/:simulationId/runs. */
export function createRunRoutes(scheduler: Scheduler) {
  const runRoutes = Router({ mergeParams: true });

  runRoutes.get('/',
    validateParams({ simulationId: vUuid() }),
    asyncHandler(async (req, res) => {
      const { simulationId } = req.validatedParams as { simulationId: string };
      res.json(await scheduler.listRuns(simulationId));
    }),
  );

  // 409 if another simulation already has a started run.
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

  runRoutes.get('/:runId/status',
    validateParams({ simulationId: vUuid(), runId: vUuid() }),
    asyncHandler(async (req, res) => {
      const { simulationId, runId } = req.validatedParams as { simulationId: string; runId: string };
      const run = await scheduler.getRun(simulationId, runId);
      res.json({ id: run.id, simulation_id: run.simulation_id, status: run.status });
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

/** Mounted at /api/simulations/runs. */
export function createRunCollectionRoutes(scheduler: Scheduler) {
  const routes = Router();

  routes.get('/', asyncHandler(async (_req, res) => {
    res.json(await scheduler.listRuns());
  }));

  routes.post('/',
    validateBody({ simulation_id: vUuid() }),
    asyncHandler(async (req, res) => {
      const { simulation_id: simulationId } = req.validatedBody as { simulation_id: string };
      res.status(201).json(await scheduler.startRun(simulationId));
    }),
  );

  routes.get('/active', asyncHandler(async (_req, res) => {
    res.json(await scheduler.getStartedRun());
  }));

  return routes;
}
