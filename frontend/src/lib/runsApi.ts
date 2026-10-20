import { API_BASE } from './api';

export type RunStatus = 'started' | 'completed' | 'stopped' | 'failed';

export interface SimulationRun {
  id: string;
  simulation_id: string;
  simulation_name: string;
  target_system: 'specter' | 'combat';
  simulation_length_s: number;
  started_at: string;
  completed_at: string | null;
  status: RunStatus;
  dispatched_count: number;
  /** Reports the run sends in total. */
  report_count: number;
  failure_reason: string | null;
}

/** A failed request, with the HTTP status so callers can explain it. */
export class RunRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function runsUrl(path: string): string {
  return API_BASE ? `${String(API_BASE).replace(/\/$/, '')}${path}` : path;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(runsUrl(path), init);
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new RunRequestError(payload?.error ?? `Request failed (${response.status})`, response.status);
  }
  return response.json() as Promise<T>;
}

export function getSimulationRuns() {
  return request<SimulationRun[]>('/api/simulations/runs');
}

export function getRunningSimulation() {
  return request<SimulationRun | null>('/api/simulations/runs/active');
}

/** Starts a run. Rejects with status 409 while another simulation is running. */
export function startRun(simulationId: string) {
  return request<{ id: string; status: RunStatus }>(
    `/api/simulations/${encodeURIComponent(simulationId)}/runs`,
    { method: 'POST' },
  );
}

/** Stops a started run. Rejects with status 409 if it already ended. */
export function stopRun(simulationId: string, runId: string) {
  return request<{ id: string; status: RunStatus }>(
    `/api/simulations/${encodeURIComponent(simulationId)}/runs/${encodeURIComponent(runId)}/stop`,
    { method: 'POST' },
  );
}
