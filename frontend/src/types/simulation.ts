export type DifficultyLevel = 'קל' | 'בינוני' | 'קשה' | 'מומחה';

export type EventCategory = string;

export interface SimulationEvent {
  id: string;
  title: string;
  category: EventCategory;
  categoryName?: string;
  categoryId?: string;
  subCategory?: string;
  subCategoryId?: string | null;
  reportUrl?: string;
  matches?: string[];
  city?: string | null;
  country?: string | null;
  threatLevel?: number | null;
  minute: number;
  description: string;
}

export interface SimulationFormData {
  title: string;
  description: string;
  difficulty: DifficultyLevel;
}

export interface Simulation extends SimulationFormData {
  id: string;
  aiGenerated?: boolean;
  lengthSeconds?: number;
  /** Target system the simulation was built for. Missing on older saves, which are SPECTRE. */
  sys?: 'spectre' | 'cm';
  events: SimulationEvent[];
  createdAt: string;
}
