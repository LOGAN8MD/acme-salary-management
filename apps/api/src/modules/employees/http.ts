import { Router } from 'express';
import { employeeDirectoryQuerySchema } from '@acme/contracts';
import { HttpError } from '../../middleware/errors.js';
import type { EmployeeService } from './service.js';

export function createEmployeeRouter(service: EmployeeService) {
  const router = Router();
  router.get('/filter-options', async (_request, response) => {
    response.json(await service.filterOptions());
  });
  router.get('/', async (request, response) => {
    const parsed = employeeDirectoryQuerySchema.safeParse(request.query);
    if (!parsed.success)
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'Employee directory filters are invalid.',
      );
    response.json(await service.list(parsed.data));
  });
  return router;
}
