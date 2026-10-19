import { DifficultyLevel, Simulation, SimulationEvent } from '../types/simulation';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error ?? 'The request failed.');
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function getHealth(): Promise<any> {
  return requestJson('/health');
}

interface CreateSimulationInput {
  title: string;
  description: string;
  difficulty: DifficultyLevel;
  events: SimulationEvent[];
}

interface CreatedSimulation {
  id: string;
  createdAt: string;
}

export async function createSimulation(
  input: CreateSimulationInput,
): Promise<CreatedSimulation> {
  return requestJson('/api/simulations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function listSimulations(): Promise<Simulation[]> {
  return requestJson('/api/simulations');
}

export async function getSimulation(id: string): Promise<Simulation> {
  return requestJson(`/api/simulations/${encodeURIComponent(id)}`);
}

export async function deleteSimulation(id: string): Promise<void> {
  await requestJson(`/api/simulations/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
