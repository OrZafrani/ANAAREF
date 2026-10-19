export type DifficultyLevel = 'קל' | 'בינוני' | 'קשה' | 'מומחה';

export type EventCategory = 'מבצעי' | 'התראה' | 'תקלה' | 'חירום' | 'תקשורת';

export interface SimulationEvent {
  id: string;
  title: string;
  category: EventCategory;
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

