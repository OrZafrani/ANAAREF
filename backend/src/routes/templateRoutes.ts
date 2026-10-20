import { Router } from 'express';
import {
  asyncHandler,
  validateBody,
  validateParams,
  validateQuery,
  vOptionalString,
  vOptionalUuid,
  vUuid,
} from '../lib/validate.js';
import { reportFields } from '../lib/reportFields.js';
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
  ...reportFields,
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