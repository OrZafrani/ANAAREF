import { DifficultyLevel, Simulation, SimulationEvent } from '../types/simulation';
import type { AiSimulationReport, GenerationResponse, GenerationSettings } from '../types/aiSimulation';

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

export interface CreateAiSimulationInput {
  title: string;
  description: string;
  difficulty: DifficultyLevel;
  sys: 'spectre';
  ai_generated: true;
  length_s: number;
  reports: AiSimulationReport[];
}

export async function createSimulation(
  input: CreateSimulationInput | CreateAiSimulationInput,
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

export function startAiGeneration(input: {
  description: string; region: string; country: string; area: GenerationSettings['area'];
  length_s: number; report_count: number; noise_level: GenerationSettings['noise_level'];
}, signal?: AbortSignal): Promise<{ runId: string; status: 'queued' | 'running' }> {
  return requestJson('/api/ai/generations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal,
  });
}

export function getAiGeneration(runId: string, signal?: AbortSignal): Promise<GenerationResponse> {
  return requestJson(`/api/ai/generations/${encodeURIComponent(runId)}`, { signal });
}
