export type DifficultyLevel = 'קל' | 'בינוני' | 'קשה' | 'מומחה';

export type EventCategory = string;

export interface SimulationEvent {
  id: string;
  title: string;
  category: EventCategory;
  categoryId?: string;
  subCategory?: string;
  subCategoryId?: string | null;
  reportUrl?: string;
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
  events: SimulationEvent[];
  createdAt: string;
}
