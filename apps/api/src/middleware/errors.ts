import type { ErrorRequestHandler } from 'express';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  void _next;
  const malformed =
    error instanceof SyntaxError &&
    'type' in error &&
    error.type === 'entity.parse.failed';
  const tooLarge =
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large';
  const failure =
    error instanceof HttpError
      ? error
      : malformed || tooLarge
        ? new HttpError(
            400,
            'VALIDATION_ERROR',
            'Request body is invalid or too large.',
          )
        : new HttpError(
            500,
            'INTERNAL_ERROR',
            'Unable to complete the request.',
          );
  response.status(failure.status).json({
    error: {
      code: failure.code,
      message: failure.message,
      requestId: response.locals.requestId,
    },
  });
};
