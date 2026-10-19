import { Router } from 'express';
import {
  asyncHandler,
  validateParams,
  validateQuery,
  vOptionalString,
  vOptionalUuid,
  vUuid,
} from '../lib/validate.js';
import { getLibraryReport, listLibraryReports } from '../services/libraryReportService.js';

export const libraryRoutes = Router();

libraryRoutes.get('/reports',
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
    res.json(await listLibraryReports({
      categoryId: query.category_id,
      subCategoryId: query.sub_category_id,
      search: query.search,
    }));
  }),
);

libraryRoutes.get('/reports/:id',
  validateParams({ id: vUuid() }),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as { id: string };
    res.json(await getLibraryReport(id));
  }),
);