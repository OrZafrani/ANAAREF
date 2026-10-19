import { Router } from 'express';
import {
  asyncHandler,
  validateBody,
  validateParams,
  validateQuery,
  vBoolean,
  vDouble,
  vInteger,
  vIsoDate,
  vHttpUrl,
  vNullable,
  vOptionalPattern,
  vOptionalString,
  vOptionalUuid,
  vRequiredString,
  vStringArray,
  vUuid,
} from '../lib/validate.js';
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
} from '../services/templateService.js';

export const templateRoutes = Router();

const templateFields = {
  category_id: vUuid(),
  sub_category_id: vOptionalUuid(),
  schema_version: vInteger({ min: 1 }),
  is_official: vBoolean(),
  platform: vRequiredString(100),
  account_name: vOptionalString(200),
  channel_name: vOptionalString(200),
  report_url: vHttpUrl(),
  report_title: vOptionalString(500),
  original_language: vOptionalPattern(/^[a-z]{2}$/, 2, 'Two lowercase language letters expected'),
  matches: vStringArray(),
  published_at: vNullable(vIsoDate()),
  collected_at: vIsoDate(),
  original_content: vRequiredString(50000),
  translated_content: vOptionalString(50000),
  threat_level: vNullable(vInteger({ min: 0, max: 100 })),
  happened_at: vNullable(vIsoDate()),
  country: vOptionalPattern(/^[A-Z]{2}$/, 2, 'Two uppercase country letters expected'),
  city: vOptionalString(200),
  lat: vNullable(vDouble({ min: -90, max: 90 })),
  long: vNullable(vDouble({ min: -180, max: 180 })),
  red_injured_count: vNullable(vInteger({ min: 0 })),
  red_death_count: vNullable(vInteger({ min: 0 })),
  blue_injured_count: vNullable(vInteger({ min: 0 })),
  blue_death_count: vNullable(vInteger({ min: 0 })),
  fastbreak_model_version: vOptionalString(100),
};

templateRoutes.get('/',
  validateQuery({
    category_id: vOptionalUuid(),
    sub_category_id: vOptionalUuid(),
    search: vOptionalString(500),
  }),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as {
      category_id: string | null;
      sub_category_id: string | null;
      search: string | null;
    };
    res.json(await listTemplates({
      categoryId: query.category_id,
      subCategoryId: query.sub_category_id,
      search: query.search,
    }));
  }),
);

templateRoutes.get('/:id', validateParams({ id: vUuid() }), asyncHandler(async (req, res) => {
  const { id } = req.validatedParams as { id: string };
  res.json(await getTemplate(id));
}));

templateRoutes.post('/', validateBody(templateFields), asyncHandler(async (req, res) => {
  res.status(201).json(await createTemplate(req.validatedBody!));
}));

templateRoutes.patch('/:id',
  validateParams({ id: vUuid() }),
  validateBody(templateFields, { partial: true }),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as { id: string };
    res.json(await updateTemplate(id, req.validatedBody!));
  }),
);

templateRoutes.delete('/:id', validateParams({ id: vUuid() }), asyncHandler(async (req, res) => {
  const { id } = req.validatedParams as { id: string };
  await deleteTemplate(id);
  res.status(204).end();
}));