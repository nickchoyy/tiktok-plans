import { ApiErrorSchema } from './library-types';
export class ClientError extends Error {
  constructor(
    message: string,
    public code = '',
    public alternatives: string[] = [],
  ) {
    super(message);
  }
}
export async function apiRequest(path: string, body: unknown, signal?: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
      body: body instanceof FormData ? body : JSON.stringify(body),
      signal: signal || AbortSignal.timeout(170000),
      cache: 'no-store',
    });
  } catch {
    throw new ClientError(
      'The request could not finish. Check your connection and try again.',
      'NETWORK',
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(data);
    throw new ClientError(
      parsed.success ? parsed.data.error.message : 'The service returned an unexpected response.',
      parsed.success ? parsed.data.error.code : 'SERVER_ERROR',
      parsed.success ? parsed.data.error.alternatives : [],
    );
  }
  return data as unknown;
}
