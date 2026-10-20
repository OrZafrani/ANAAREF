import type { Request, Response } from 'express';
import * as simulationsService from '../services/simulations.service.js';

export async function listSimulations(_req: Request, res: Response): Promise<void> {
  res.json(await simulationsService.listSimulations());
}

export async function getSimulation(req: Request, res: Response): Promise<void> {
  res.json(await simulationsService.getSimulation(req.params.id));
}

export async function createSimulation(req: Request, res: Response): Promise<void> {
  res.status(201).json(await simulationsService.createSimulation(req.body));
}

export async function updateSimulation(req: Request, res: Response): Promise<void> {
  res.json(await simulationsService.updateSimulation(req.params.id, req.body));
}

export async function deleteSimulation(req: Request, res: Response): Promise<void> {
  await simulationsService.deleteSimulation(req.params.id);
  res.status(204).end();
}