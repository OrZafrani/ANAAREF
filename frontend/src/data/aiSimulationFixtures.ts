import type { CategoryNode, LibraryTemplate } from '../lib/libraryApi';
import type { ReportPayload } from '../types/aiSimulation';

export const DEMO_PROMPTS = [
  'מטח רקטות על שדרות עם 3 פצועים, ובמקביל אירוע חירום בירושלים. רמה קשה, 45 דקות',
  'תרגיל חילוץ בחיפה עם דיווחים כפולים ורעש רקע. רמה קלה, 20 דקות',
  'שריפה בבאר שבע, כמה מוקדים במקביל ודיווחים לא מאומתים. רמה בינונית, 30 דקות',
];

export const MOCK_REPORT_PAYLOAD: ReportPayload = {
  reality_id: 1,
  schema_version: 2,
  is_official: false,
  platform: 'telegram',
  account_name: 'cobra_demo',
  channel_name: 'ערוץ הדגמה סינתטי',
  report_url: 'https://example.invalid/cobra/demo',
  report_title: 'דיווח ראשוני לצורכי תרגול',
  original_language: 'he',
  published_at: '2026-01-01T08:00:00.000Z',
  happened_at: '2026-01-01T08:00:00.000Z',
  collected_at: '2026-01-01T08:01:00.000Z',
  original_content: 'דיווח סינתטי לצורכי תרגול בלבד. המידע הראשוני נבדק מול מקורות נוספים.',
  translated_content: null,
  threat_level: 50,
  country: 'IL',
  city: null,
  lat: null,
  long: null,
  red_injured_count: null,
  red_death_count: null,
  blue_injured_count: null,
  blue_death_count: null,
  fastbreak_model_version: 'cobra-frontend-mock',
};

export const MOCK_REPORT_STAGES = [
  { title: 'דיווח ראשוני על אירוע תרגול', content: 'התקבל דיווח ראשוני ממקור פתוח. פרטי האירוע והיקפו עדיין בבדיקה.' },
  { title: 'אימות ראשוני ממקור נוסף', content: 'מקור נוסף מדווח על אותו מוקד. צוות התרגיל מצליב מיקום וזמן לפני עדכון התמונה.' },
  { title: 'צוותי חירום הגיעו לנקודת הכינוס', content: 'צוותי החירום בתרגיל נערכים באזור. תמונת הנפגעים טרם אומתה.' },
  { title: 'עדכון תמונת המצב בתרגיל', content: 'התקבל עדכון מהשטח. יש להפריד בין פרטים מאומתים לבין דיווחים שעדיין בבדיקה.' },
];

const categoryId = 'd0000000-0000-4000-8000-000000000001';
const subCategoryId = 'd0000000-0000-4000-8000-000000000002';

export const MOCK_LIBRARY_TEMPLATES: LibraryTemplate[] = [
  {
    ...MOCK_REPORT_PAYLOAD,
    id: 'd0000000-0000-4000-8000-000000000003',
    category_id: categoryId,
    sub_category_id: subCategoryId,
    category_name: 'חירום אזרחי',
    sub_category_name: 'דיווחי תרגול',
    template_created_at: '2026-01-01T08:00:00.000Z',
    template_updated_at: '2026-01-01T08:00:00.000Z',
    report_title: 'צוותי חילוץ הגיעו לאזור התרגיל',
    original_content: 'צוותי חילוץ ורפואה נערכים בנקודת הכינוס. אין נפגעים מאומתים בשלב זה. דיווח הדגמה בלבד.',
    report_url: 'https://example.invalid/cobra/library/rescue',
    city: 'חיפה',
    lat: 32.794,
    long: 34.989,
    blue_death_count: 0,
  },
  {
    ...MOCK_REPORT_PAYLOAD,
    id: 'd0000000-0000-4000-8000-000000000004',
    category_id: categoryId,
    sub_category_id: null,
    category_name: 'חירום אזרחי',
    sub_category_name: null,
    template_created_at: '2026-01-01T08:00:00.000Z',
    template_updated_at: '2026-01-01T08:00:00.000Z',
    report_title: 'הודעת שגרה: בדיקת מערכת כריזה',
    original_content: 'בדיקת כריזה מתוכננת בבאר שבע, ללא קשר לאירועי התרגיל. דיווח הדגמה בלבד.',
    report_url: 'https://example.invalid/cobra/library/routine',
    city: 'באר שבע',
    lat: 31.252,
    long: 34.792,
    threat_level: 10,
    blue_injured_count: 0,
    blue_death_count: 0,
  },
];

export const MOCK_LIBRARY_CATEGORIES: CategoryNode[] = [{
  id: categoryId,
  name: 'חירום אזרחי',
  report_count: MOCK_LIBRARY_TEMPLATES.length,
  sub_categories: [{
    id: subCategoryId,
    category_id: categoryId,
    name: 'דיווחי תרגול',
    report_count: 1,
  }],
}];
