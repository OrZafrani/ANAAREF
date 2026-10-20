export interface CategoryNode {
  id: string;
  name: string;
  report_count: number;
  sub_categories: SubCategoryNode[];
}

export interface SubCategoryNode {
  id: string;
  category_id: string;
  name: string;
  report_count: number;
}

export interface LibraryTemplate {
  id: string;
  category_id: string;
  sub_category_id: string | null;
  category_name?: string;
  sub_category_name?: string | null;
  template_created_at: string;
  template_updated_at: string;
  schema_version: number;
  is_official: boolean;
  platform: string;
  account_name: string | null;
  channel_name: string | null;
  report_url: string;
  report_title: string | null;
  original_language: string | null;
  published_at: string | null;
  happened_at: string | null;
  collected_at: string;
  original_content: string;
  translated_content: string | null;
  threat_level: number | null;
  country: string | null;
  city: string | null;
  lat: number | null;
  long: number | null;
  red_injured_count: number | null;
  red_death_count: number | null;
  blue_injured_count: number | null;
  blue_death_count: number | null;
  fastbreak_model_version: string | null;
}

export type TemplateWrite = Omit<LibraryTemplate,
  'id' | 'template_created_at' | 'template_updated_at' | 'category_name' | 'sub_category_name'>;

export const LIBRARY_API_BASE = (import.meta as any).env?.VITE_API_URL ?? '';

function libraryUrl(path: string): string {
  if (!LIBRARY_API_BASE) return path;
  return `${String(LIBRARY_API_BASE).replace(/\/$/, '')}${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(libraryUrl(path), {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }
  return payload as T;
}

export function getCategoryTree() {
  return request<CategoryNode[]>('/api/categories/tree');
}

export function getTemplates(filters: { search?: string; categoryId?: string; subCategoryId?: string }) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.categoryId) params.set('category_id', filters.categoryId);
  if (filters.subCategoryId) params.set('sub_category_id', filters.subCategoryId);
  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return request<LibraryTemplate[]>(`/api/templates${suffix}`);
}

export function createCategory(name: string) {
  return request('/api/categories', { method: 'POST', body: JSON.stringify({ name }) });
}

export function renameCategory(id: string, name: string) {
  return request(`/api/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
}

export function deleteCategory(id: string) {
  return request<void>(`/api/categories/${id}`, { method: 'DELETE' });
}

export function createSubCategory(categoryId: string, name: string) {
  return request(`/api/categories/${categoryId}/sub-categories`, {
    method: 'POST', body: JSON.stringify({ name }),
  });
}

export function renameSubCategory(id: string, name: string, categoryId?: string) {
  return request(`/api/sub-categories/${id}`, {
    method: 'PATCH', body: JSON.stringify({ name, ...(categoryId ? { category_id: categoryId } : {}) }),
  });
}

export function deleteSubCategory(id: string) {
  return request<void>(`/api/sub-categories/${id}`, { method: 'DELETE' });
}

export function createTemplate(template: TemplateWrite) {
  return request<LibraryTemplate>('/api/templates', { method: 'POST', body: JSON.stringify(template) });
}

export function updateTemplate(id: string, template: TemplateWrite) {
  return request<LibraryTemplate>(`/api/templates/${id}`, {
    method: 'PATCH', body: JSON.stringify(template),
  });
}

export function deleteTemplate(id: string) {
  return request<void>(`/api/templates/${id}`, { method: 'DELETE' });
}
