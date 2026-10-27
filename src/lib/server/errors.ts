import { z } from 'zod';
export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public alternatives: string[] = [],
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof ServiceError)
    return Response.json(
      { error: { code: error.code, message: error.message, alternatives: error.alternatives } },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } },
    );
  if (error instanceof z.ZodError)
    return Response.json(
      {
        error: {
          code: 'INVALID_INPUT',
          message: 'Some fields are invalid. Check the input and try again.',
          alternatives: error.issues.slice(0, 4).map((i) => `${i.path.join('.')}: ${i.message}`),
        },
      },
      { status: 400 },
    );
  return Response.json(
    {
      error: {
        code: 'PROVIDER_ERROR',
        message:
          'The service could not complete this request. Your saved content is unchanged. Try again later.',
      },
    },
    { status: 502 },
  );
}
