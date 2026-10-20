import { DifficultyLevel } from '../types/simulation';

/** Default streaming settings per difficulty, as offered in the builder (CreateSimulation). */
export const DIFFICULTY_PRESETS: Record<DifficultyLevel, { level: 1 | 2 | 3; ratePerMin: number | null; durationMin: number | null }> = {
  'קל': { level: 1, ratePerMin: 2, durationMin: 20 },
  'בינוני': { level: 2, ratePerMin: 4, durationMin: 30 },
  'קשה': { level: 3, ratePerMin: 8, durationMin: 45 },
};

export const DIFFICULTY_FILTERS: DifficultyLevel[] = ['קל', 'בינוני', 'קשה'];
