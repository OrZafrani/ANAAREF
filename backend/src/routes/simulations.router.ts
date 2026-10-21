import { Router } from 'express';
import * as simulationsController from '../controllers/simulations.controller.js';
import type { RequestHandler } from 'express';

const router = Router();
const asyncHandler = (handler: RequestHandler): RequestHandler => (req, res, next) => {
	Promise.resolve(handler(req, res, next)).catch(next);
};

router.get('/', asyncHandler(simulationsController.listSimulations));
router.get('/:id', asyncHandler(simulationsController.getSimulation));
router.post('/', asyncHandler(simulationsController.createSimulation));
router.put('/:id', asyncHandler(simulationsController.updateSimulation));
router.delete('/:id', asyncHandler(simulationsController.deleteSimulation));


export default router;