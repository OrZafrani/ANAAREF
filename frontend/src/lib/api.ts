import { DifficultyLevel, Simulation, SimulationEvent } from '../types/simulation';

export const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '';

function apiUrl(path: string): string {
  if (!API_BASE) return path;
  return `${String(API_BASE).replace(/\/$/, '')}${path}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(url), init);

  if (response.status === 204) return undefined as T;

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error((result as any)?.error ?? 'The request failed.');
  }

  return result as T;
}

export async function getHealth(): Promise<any> {
  return requestJson('/health');
}

interface CreateSimulationInput {
  title: string;
  description: string;
  difficulty: DifficultyLevel;
  sys?: Simulation['sys'];
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

export async function updateSimulation(
  id: string,
  input: CreateSimulationInput,
): Promise<CreatedSimulation> {
  return requestJson(`/api/simulations/${encodeURIComponent(id)}`, {
    method: 'PUT',
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
