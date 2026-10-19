import { Router } from 'express';
import {
  asyncHandler,
  validateBody,
  validateParams,
  validateQuery,
  vOptionalString,
  vOptionalUuid,
  vRequiredString,
  vUuid,
} from '../lib/validate.js';
import {
  createCategory,
  createSubCategory,
  deleteCategory,
  deleteSubCategory,
  getCategoryTree,
  listSubCategories,
  renameCategory,
  updateSubCategory,
} from '../services/categoryService.js';

export const categoryRoutes = Router();
export const subCategoryRoutes = Router();

const subCategoryListQuery = { category_id: vOptionalUuid() };

categoryRoutes.get('/', asyncHandler(async (_req, res) => {
  res.json(await getCategoryTree());
}));

categoryRoutes.get('/tree', asyncHandler(async (_req, res) => {
  res.json(await getCategoryTree());
}));

categoryRoutes.post('/', validateBody({ name: vRequiredString(200) }), asyncHandler(async (req, res) => {
  const { name } = req.validatedBody as { name: string };
  res.status(201).json(await createCategory(name));
}));

categoryRoutes.patch('/:id',
  validateParams({ id: vUuid() }),
  validateBody({ name: vRequiredString(200) }),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as { id: string };
    const { name } = req.validatedBody as { name: string };
    res.json(await renameCategory(id, name));
  }),
);

categoryRoutes.delete('/:id', validateParams({ id: vUuid() }), asyncHandler(async (req, res) => {
  const { id } = req.validatedParams as { id: string };
  await deleteCategory(id);
  res.status(204).end();
}));

categoryRoutes.post('/:id/sub-categories',
  validateParams({ id: vUuid() }),
  validateBody({ name: vRequiredString(200) }),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as { id: string };
    const { name } = req.validatedBody as { name: string };
    res.status(201).json(await createSubCategory(id, name));
  }),
);

categoryRoutes.get('/:id/sub-categories',
  validateParams({ id: vUuid() }),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as { id: string };
    res.json(await listSubCategories(id));
  }),
);

categoryRoutes.patch('/:categoryId/sub-categories/:subCategoryId',
  validateParams({ categoryId: vUuid(), subCategoryId: vUuid() }),
  validateBody({ name: vOptionalString(200) }, { partial: true }),
  asyncHandler(async (req, res) => {
    const { categoryId, subCategoryId } = req.validatedParams as {
      categoryId: string;
      subCategoryId: string;
    };
    const { name } = req.validatedBody as { name: string | null };
    res.json(await updateSubCategory(subCategoryId, { name, categoryId: null }, categoryId));
  }),
);

categoryRoutes.delete('/:categoryId/sub-categories/:subCategoryId',
  validateParams({ categoryId: vUuid(), subCategoryId: vUuid() }),
  asyncHandler(async (req, res) => {
    const { categoryId, subCategoryId } = req.validatedParams as {
      categoryId: string;
      subCategoryId: string;
    };
    await deleteSubCategory(subCategoryId, categoryId);
    res.status(204).end();
  }),
);

subCategoryRoutes.get('/',
  validateQuery(subCategoryListQuery),
  asyncHandler(async (req, res) => {
    const { category_id: categoryId } = req.validatedQuery as { category_id: string | null };
    res.json(await listSubCategories(categoryId));
  }),
);

subCategoryRoutes.post('/',
  validateBody({ category_id: vUuid(), name: vRequiredString(200) }),
  asyncHandler(async (req, res) => {
    const { category_id: categoryId, name } = req.validatedBody as {
      category_id: string;
      name: string;
    };
    res.status(201).json(await createSubCategory(categoryId, name));
  }),
);

subCategoryRoutes.patch('/:id',
  validateParams({ id: vUuid() }),
  validateBody({ name: vOptionalString(200), category_id: vOptionalUuid() }),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as { id: string };
    const { name, category_id: categoryId } = req.validatedBody as {
      name: string | null;
      category_id: string | null;
    };
    res.json(await updateSubCategory(id, { name, categoryId }));
  }),
);

subCategoryRoutes.delete('/:id', validateParams({ id: vUuid() }), asyncHandler(async (req, res) => {
  const { id } = req.validatedParams as { id: string };
  await deleteSubCategory(id);
  res.status(204).end();
}));