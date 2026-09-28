import { Router } from 'express';
import {
  employeeDirectoryQuerySchema,
  employeeIdSchema,
  salaryHistoryQuerySchema,
  salaryUpdateInputSchema,
} from '@acme/contracts';
import { HttpError } from '../../middleware/errors.js';
import type { EmployeeService } from './service.js';

export function createEmployeeRouter(service: EmployeeService) {
  const router = Router();
  router.get('/filter-options', async (_request, response) => {
    response.json(await service.filterOptions());
  });
  router.get('/:employeeId/salary-history', async (request, response) => {
    const employeeId = employeeIdSchema.safeParse(request.params.employeeId);
    const query = salaryHistoryQuerySchema.safeParse(request.query);
    if (!employeeId.success || !query.success)
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'Employee identifier or salary history pagination is invalid.',
      );
    const history = await service.salaryHistory(employeeId.data, query.data);
    if (!history)
      throw new HttpError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found.');
    response.json(history);
  });
  router.patch('/:employeeId/salary', async (request, response) => {
    const employeeId = employeeIdSchema.safeParse(request.params.employeeId);
    const input = salaryUpdateInputSchema.safeParse(request.body);
    if (!employeeId.success || !input.success)
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'Enter a valid salary amount, reason, and expected version.',
      );
    response.json(
      await service.updateSalary(
        employeeId.data,
        response.locals.userId as string,
        input.data,
      ),
    );
  });
  router.get('/:employeeId', async (request, response) => {
    const employeeId = employeeIdSchema.safeParse(request.params.employeeId);
    if (!employeeId.success)
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'Employee identifier is invalid.',
      );
    const employee = await service.detail(employeeId.data);
    if (!employee)
      throw new HttpError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found.');
    response.json(employee);
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
