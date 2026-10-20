export type UrgencyLevel = 'unknown' | 'low' | 'medium' | 'high' | 'critical';

export interface Urgency {
  level: UrgencyLevel;
  label: string;
}

export function getUrgency(value: number | null | undefined): Urgency {
  if (value == null || !Number.isFinite(value)) return { level: 'unknown', label: 'לא ידוע' };
  if (value <= 25) return { level: 'low', label: 'נמוך' };
  if (value <= 50) return { level: 'medium', label: 'בינוני' };
  if (value <= 75) return { level: 'high', label: 'גבוה' };
  return { level: 'critical', label: 'קריטי' };
}
