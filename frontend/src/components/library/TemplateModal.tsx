import { useEffect, useState, type FormEvent } from 'react';
import CoordinatePicker from './CoordinatePicker';
import type { CategoryNode, LibraryTemplate, TemplateWrite } from '../../lib/libraryApi';
import { getUrgency } from '../../lib/urgency';

type ModalMode = 'view' | 'edit' | 'create';
type FormState = {
  category_id: string;
  sub_category_id: string;
  schema_version: string;
  is_official: boolean;
  platform: string;
  account_name: string;
  channel_name: string;
  report_url: string;
  report_title: string;
  original_language: string;
  published_at: string;
  collected_at: string;
  original_content: string;
  translated_content: string;
  threat_level: string;
  happened_at: string;
  country: string;
  city: string;
  lat: string;
  long: string;
  red_injured_count: string;
  red_death_count: string;
  blue_injured_count: string;
  blue_death_count: string;
  fastbreak_model_version: string;
};

interface TemplateModalProps {
  mode: ModalMode;
  template: LibraryTemplate | null;
  categories: CategoryNode[];
  canWrite: boolean;
  initialCategoryId: string | null;
  initialSubCategoryId: string | null;
  onClose: () => void;
  onSave: (value: TemplateWrite) => Promise<void>;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}

const localDateValue = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const isoDateValue = (value: string) => value ? new Date(value).toISOString() : null;
const nullableNumber = (value: string) => value.trim() === '' ? null : Number(value);
const nullableText = (value: string) => value.trim() || null;
const displayValue = (value: unknown) => value === null || value === undefined || value === '' ? 'לא דווח' : String(value);

function createForm(
  template: LibraryTemplate | null,
  categories: CategoryNode[],
  initialCategoryId: string | null,
  initialSubCategoryId: string | null,
): FormState {
  const firstCategory = categories[0];
  return {
    category_id: template?.category_id ?? initialCategoryId ?? firstCategory?.id ?? '',
    sub_category_id: template?.sub_category_id ?? initialSubCategoryId ?? '',
    schema_version: String(template?.schema_version ?? 2),
    is_official: template?.is_official ?? false,
    platform: template?.platform ?? 'telegram',
    account_name: template?.account_name ?? '',
    channel_name: template?.channel_name ?? '',
    report_url: template?.report_url ?? '',
    report_title: template?.report_title ?? '',
    original_language: template?.original_language ?? 'he',
    published_at: localDateValue(template?.published_at),
    collected_at: localDateValue(template?.collected_at ?? new Date().toISOString()),
    original_content: template?.original_content ?? '',
    translated_content: template?.translated_content ?? '',
    threat_level: template?.threat_level === null || template?.threat_level === undefined ? '' : String(template.threat_level),
    happened_at: localDateValue(template?.happened_at),
    country: template?.country ?? 'IL',
    city: template?.city ?? '',
    lat: template?.lat === null || template?.lat === undefined ? '' : String(template.lat),
    long: template?.long === null || template?.long === undefined ? '' : String(template.long),
    red_injured_count: template?.red_injured_count == null ? '' : String(template.red_injured_count),
    red_death_count: template?.red_death_count == null ? '' : String(template.red_death_count),
    blue_injured_count: template?.blue_injured_count == null ? '' : String(template.blue_injured_count),
    blue_death_count: template?.blue_death_count == null ? '' : String(template.blue_death_count),
    fastbreak_model_version: template?.fastbreak_model_version ?? 'fastbreak-v2.4.1',
  };
}

export default function TemplateModal({ mode, template, categories, canWrite, initialCategoryId, initialSubCategoryId, onClose, onSave, onEdit, onDelete }: TemplateModalProps) {
  const [form, setForm] = useState(() => createForm(template, categories, initialCategoryId, initialSubCategoryId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const editable = mode !== 'view' && canWrite;
  const selectedCategory = categories.find((category) => category.id === form.category_id);
  const subCategories = selectedCategory?.sub_categories ?? [];

  useEffect(() => {
    setForm(createForm(template, categories, initialCategoryId, initialSubCategoryId));
    setError('');
  }, [template, categories, mode, initialCategoryId, initialSubCategoryId]);

  const setField = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({
        category_id: form.category_id,
        sub_category_id: form.sub_category_id || null,
        schema_version: Number(form.schema_version),
        is_official: form.is_official,
        platform: form.platform.trim(),
        account_name: nullableText(form.account_name),
        channel_name: nullableText(form.channel_name),
        report_url: form.report_url.trim(),
        report_title: nullableText(form.report_title),
        original_language: nullableText(form.original_language)?.toLowerCase() ?? null,
        published_at: isoDateValue(form.published_at),
        collected_at: isoDateValue(form.collected_at) ?? new Date().toISOString(),
        original_content: form.original_content,
        translated_content: nullableText(form.translated_content),
        threat_level: nullableNumber(form.threat_level),
        happened_at: isoDateValue(form.happened_at),
        country: nullableText(form.country)?.toUpperCase() ?? null,
        city: nullableText(form.city),
        lat: nullableNumber(form.lat),
        long: nullableNumber(form.long),
        red_injured_count: nullableNumber(form.red_injured_count),
        red_death_count: nullableNumber(form.red_death_count),
        blue_injured_count: nullableNumber(form.blue_injured_count),
        blue_death_count: nullableNumber(form.blue_death_count),
        fastbreak_model_version: nullableText(form.fastbreak_model_version),
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'שמירת התבנית נכשלה');
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'view' ? template?.report_title || 'תבנית ללא כותרת'
    : mode === 'edit' ? 'עריכת תבנית' : 'תבנית חדשה';
  const urgency = template ? getUrgency(template.threat_level) : null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="template-modal" role="dialog" aria-modal="true" aria-labelledby="template-modal-title" dir="rtl">
        <header className="modal-heading">
          <div>
            <span className="eyebrow">ספריית תבניות</span>
            <h2 id="template-modal-title">{title}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="סגירה" onClick={onClose}>×</button>
        </header>

        {mode === 'view' && template ? (
          <div className="template-details">
            <div className="detail-badges">
              <span className="platform-tag">{template.platform}</span>
              <span className={`threat-tag threat-${urgency?.level ?? 'unknown'}`}>
                {urgency?.level === 'unknown' ? 'דחיפות לא ידועה' : `דחיפות: ${urgency?.label} (${displayValue(template.threat_level)})`}
              </span>
              <span>{template.is_official ? 'מקור רשמי' : 'מקור פתוח'}</span>
            </div>
            <p className="detail-content">{template.original_content}</p>
            {template.translated_content && <p className="detail-translation">{template.translated_content}</p>}
            <dl className="detail-grid">
              <div><dt>קטגוריה</dt><dd>{template.category_name ?? 'לא משויך'}</dd></div>
              <div><dt>תת-קטגוריה</dt><dd>{template.sub_category_name ?? 'ללא תת-קטגוריה'}</dd></div>
              <div><dt>עיר / מדינה</dt><dd>{[template.city, template.country].filter(Boolean).join(', ') || 'לא דווח'}</dd></div>
              <div><dt>מיקום</dt><dd>{template.lat != null && template.long != null
                ? <a href={`https://www.openstreetmap.org/?mlat=${template.lat}&mlon=${template.long}#map=13/${template.lat}/${template.long}`} target="_blank" rel="noreferrer">{template.lat}, {template.long}</a>
                : 'לא דווח'}</dd></div>
              <div><dt>חשבון / ערוץ</dt><dd>{[template.account_name, template.channel_name].filter(Boolean).join(' · ') || 'לא דווח'}</dd></div>
              <div><dt>פורסם</dt><dd>{template.published_at ? new Date(template.published_at).toLocaleString('he-IL') : 'לא דווח'}</dd></div>
              <div><dt>נאסף</dt><dd>{new Date(template.collected_at).toLocaleString('he-IL')}</dd></div>
              <div><dt>פצועים - צד אדום</dt><dd>{displayValue(template.red_injured_count)}</dd></div>
              <div><dt>הרוגים - צד אדום</dt><dd>{displayValue(template.red_death_count)}</dd></div>
              <div><dt>פצועים - צד כחול</dt><dd>{displayValue(template.blue_injured_count)}</dd></div>
              <div><dt>הרוגים - צד כחול</dt><dd>{displayValue(template.blue_death_count)}</dd></div>
              <div><dt>קישור מקור</dt><dd><a href={template.report_url} target="_blank" rel="noreferrer">פתיחת מקור ↗</a></dd></div>
              <div><dt>עודכן</dt><dd>{new Date(template.template_updated_at).toLocaleString('he-IL')}</dd></div>
            </dl>
            <footer className="modal-actions">
              {canWrite && <button className="button button-primary" type="button" onClick={onEdit}>עריכת התבנית</button>}
              <button className="button button-quiet" type="button" onClick={onClose}>סגירה</button>
            </footer>
          </div>
        ) : (
          <form className="template-form" onSubmit={submit}>
            <div className="form-scroll">
              <section className="form-section">
                <h3>סיווג ותצוגה</h3>
                <div className="form-grid">
                  <label>קטגוריה<select required value={form.category_id} onChange={(event) => {
                    setField('category_id', event.target.value);
                    setField('sub_category_id', '');
                  }} disabled={!editable}>
                    <option value="" disabled>בחירת קטגוריה</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select></label>
                  <label>תת-קטגוריה<select value={form.sub_category_id} onChange={(event) => setField('sub_category_id', event.target.value)} disabled={!editable}>
                    <option value="">ללא תת-קטגוריה</option>
                    {subCategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
                  </select></label>
                  <label>כותרת<input value={form.report_title} onChange={(event) => setField('report_title', event.target.value)} maxLength={500} disabled={!editable} /></label>
                  <label>רמת איום (0-100)<input type="number" min="0" max="100" value={form.threat_level} onChange={(event) => setField('threat_level', event.target.value)} disabled={!editable} /></label>
                  <label>פלטפורמה<input required value={form.platform} onChange={(event) => setField('platform', event.target.value)} maxLength={100} disabled={!editable} /></label>
                  <label>שפה<input value={form.original_language} onChange={(event) => setField('original_language', event.target.value.toLowerCase())} maxLength={2} pattern="[a-z]{2}" disabled={!editable} /></label>
                  <label className="checkbox-label"><input type="checkbox" checked={form.is_official} onChange={(event) => setField('is_official', event.target.checked)} disabled={!editable} /> מקור רשמי</label>
                  <label>גרסת סכימה<input type="number" min="1" required value={form.schema_version} onChange={(event) => setField('schema_version', event.target.value)} disabled={!editable} /></label>
                  <label>חשבון<input value={form.account_name} onChange={(event) => setField('account_name', event.target.value)} maxLength={200} disabled={!editable} /></label>
                  <label>ערוץ<input value={form.channel_name} onChange={(event) => setField('channel_name', event.target.value)} maxLength={200} disabled={!editable} /></label>
                  <label className="field-wide">קישור מקור<input type="url" required value={form.report_url} onChange={(event) => setField('report_url', event.target.value)} maxLength={2048} disabled={!editable} /></label>
                </div>
              </section>

              <section className="form-section">
                <h3>תוכן ומועדים</h3>
                <div className="form-grid">
                  <label>פורסם בתאריך<input type="datetime-local" value={form.published_at} onChange={(event) => setField('published_at', event.target.value)} disabled={!editable} /></label>
                  <label>התרחש בתאריך<input type="datetime-local" value={form.happened_at} onChange={(event) => setField('happened_at', event.target.value)} disabled={!editable} /></label>
                  <label>נאסף בתאריך<input type="datetime-local" required value={form.collected_at} onChange={(event) => setField('collected_at', event.target.value)} disabled={!editable} /></label>
                  <label>גרסת מודל<input value={form.fastbreak_model_version} onChange={(event) => setField('fastbreak_model_version', event.target.value)} maxLength={100} disabled={!editable} /></label>
                  <label className="field-wide">תוכן מקורי<textarea required rows={5} value={form.original_content} onChange={(event) => setField('original_content', event.target.value)} maxLength={50000} disabled={!editable} /></label>
                  <label className="field-wide">תרגום<textarea rows={4} value={form.translated_content} onChange={(event) => setField('translated_content', event.target.value)} maxLength={50000} disabled={!editable} /></label>
                </div>
              </section>

              <section className="form-section">
                <h3>מיקום ונפגעים</h3>
                <div className="form-grid">
                  <label>מדינה<input value={form.country} onChange={(event) => setField('country', event.target.value.toUpperCase())} maxLength={2} pattern="[A-Z]{2}" disabled={!editable} /></label>
                  <label>עיר / אזור<input value={form.city} onChange={(event) => setField('city', event.target.value)} maxLength={200} disabled={!editable} /></label>
                  <label>קו רוחב<input type="number" step="any" min="-90" max="90" value={form.lat} onChange={(event) => setField('lat', event.target.value)} disabled={!editable} /></label>
                  <label>קו אורך<input type="number" step="any" min="-180" max="180" value={form.long} onChange={(event) => setField('long', event.target.value)} disabled={!editable} /></label>
                  <div className="field-wide"><CoordinatePicker
                    latitude={nullableNumber(form.lat)}
                    longitude={nullableNumber(form.long)}
                    disabled={!editable}
                    onPick={(latitude, longitude) => {
                      setField('lat', latitude.toFixed(6));
                      setField('long', longitude.toFixed(6));
                    }}
                  /></div>
                  <label>פצועים - צד אדום<input type="number" min="0" value={form.red_injured_count} onChange={(event) => setField('red_injured_count', event.target.value)} disabled={!editable} /></label>
                  <label>הרוגים - צד אדום<input type="number" min="0" value={form.red_death_count} onChange={(event) => setField('red_death_count', event.target.value)} disabled={!editable} /></label>
                  <label>פצועים - צד כחול<input type="number" min="0" value={form.blue_injured_count} onChange={(event) => setField('blue_injured_count', event.target.value)} disabled={!editable} /></label>
                  <label>הרוגים - צד כחול<input type="number" min="0" value={form.blue_death_count} onChange={(event) => setField('blue_death_count', event.target.value)} disabled={!editable} /></label>
                </div>
              </section>
              {error && <p className="form-error" role="alert">{error}</p>}
            </div>
            <footer className="modal-actions">
              <button className="button button-primary" type="submit" disabled={!editable || saving}>{saving ? 'שומר...' : 'שמירת תבנית'}</button>
              {mode === 'edit' && canWrite && <button className="button button-danger" type="button" onClick={() => void onDelete()}>מחיקת תבנית</button>}
              <button className="button button-quiet" type="button" onClick={onClose}>ביטול</button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
