export type RunStatus = 'started' | 'completed' | 'stopped' | 'failed';

export interface SimulationRun {
  id: string;
  simulation_id: string;
  simulation_name: string;
  target_system: 'specter' | 'combat';
  started_at: string;
  completed_at: string | null;
  status: RunStatus;
  dispatched_count: number;
  failure_reason: string | null;
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function getSimulationRuns() {
  return request<SimulationRun[]>('/api/simulations/runs');
}

export function getRunningSimulation() {
  return request<SimulationRun | null>('/api/simulations/runs/active');
}
