import type { TemplateWrite } from '../lib/libraryApi';

export type AiDifficulty = 'easy' | 'medium' | 'hard';
export type ReportKind = 'original' | 'duplicate' | 'false' | 'noise';
export type BuilderStep = 1 | 2 | 3;

export interface AiSimulationSettings {
  id: string;
  name: string;
  description: string;
  difficulty: AiDifficulty;
  length_s: number;
  ai_generated: true;
  target_system: 'specter';
  reality_id: 1;
}

// Generation controls and report labels are frontend metadata, not new DB columns.
export interface GenerationSettings {
  reports_per_minute: number;
  duplicate_percent: number;
  false_percent: number;
  noise_percent: number;
}

export type ReportPayload = Omit<TemplateWrite, 'category_id' | 'sub_category_id'> & {
  reality_id: 1;
};

export interface AiSimulationReport {
  client_id: string;
  template_id: string | null;
  payload: ReportPayload;
  dispatch_offset_s: number;
  kind: ReportKind;
  origin: 'ai' | 'library';
  category_name: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface AiSimulationDraft {
  version: 1;
  simulation: AiSimulationSettings;
  generation: GenerationSettings;
  scenario: string;
  messages: AiChatMessage[];
  reports: AiSimulationReport[];
  generated_from: string | null;
  step: BuilderStep;
  status: 'draft' | 'saved';
  created_at: string;
  updated_at: string;
}
