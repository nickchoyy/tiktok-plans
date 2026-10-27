import { ServiceError } from './errors';
type Counter = { start: number; count: number };
const state = globalThis as typeof globalThis & { __plansLimits?: Map<string, Counter> };
const counters = (state.__plansLimits ??= new Map());
export function charge(kind: 'ai' | 'google' | 'request', units = 1) {
  const max =
    kind === 'ai'
      ? Math.min(100, Number(process.env.PLANS_MAX_AI_CALLS_PER_HOUR) || 30)
      : kind === 'google'
        ? 150
        : 100;
  const now = Date.now();
  let bucket = counters.get(kind);
  if (!bucket || now - bucket.start >= 3600000) {
    bucket = { start: now, count: 0 };
    counters.set(kind, bucket);
  }
  if (bucket.count + units > max)
    throw new ServiceError(
      'RATE_LIMIT',
      'This server’s hourly request allowance has been reached. Try again after the hour resets.',
      429,
    );
  bucket.count += units;
}
export async function boundedBody(request: Request, maxBytes = 65536) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new ServiceError('TOO_LARGE', 'This request is too large.', 413);
  if (!request.body) throw new ServiceError('EMPTY_INPUT', 'Add some content to import.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ServiceError('TOO_LARGE', 'This request exceeds the upload limit.', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function jsonBody(request: Request) {
  try {
    return JSON.parse((await boundedBody(request)).toString('utf8'));
  } catch (e) {
    if (e instanceof ServiceError) throw e;
    throw new ServiceError('INVALID_JSON', 'Send valid JSON.');
  }
}
export function guardRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const host = new URL(origin).host;
      if (host !== request.headers.get('host') && host !== new URL(request.url).host)
        throw new Error();
    } catch {
      throw new ServiceError('ORIGIN_REJECTED', 'This request must come from the Plans app.', 403);
    }
  }
  charge('request');
}
const slots = globalThis as typeof globalThis & { __plansActive?: number };
export async function withProcessingSlot<T>(operation: () => Promise<T>): Promise<T> {
  if ((slots.__plansActive || 0) >= 2)
    throw new ServiceError(
      'BUSY',
      'Two items are already processing on this server. Try again shortly.',
      429,
    );
  slots.__plansActive = (slots.__plansActive || 0) + 1;
  try {
    return await operation();
  } finally {
    slots.__plansActive!--;
  }
}
