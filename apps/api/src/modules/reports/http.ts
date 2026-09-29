import { Router } from 'express';
import { salaryReportQuerySchema } from '@acme/contracts';
import { HttpError } from '../../middleware/errors.js';
import type { ReportService } from './service.js';

export function createReportRouter(service: ReportService) {
  const router = Router();
  router.get('/salaries', async (request, response) => {
    const query = salaryReportQuerySchema.safeParse(request.query);
    if (!query.success)
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'Salary report filters are invalid.',
      );
    response.json(await service.salaries(query.data));
  });
  return router;
}
