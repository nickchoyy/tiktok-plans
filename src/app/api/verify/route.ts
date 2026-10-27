import { z } from 'zod';
import { ExtractionSchema } from '@/lib/library-types';
import { verifyExtraction } from '@/lib/server/google-places';
import { guardRequest, jsonBody } from '@/lib/server/guards';
import { errorResponse } from '@/lib/server/errors';
const Input = z.object({
  extraction: ExtractionSchema,
  selectedId: z.string().max(300).optional(),
});
export async function POST(request: Request) {
  try {
    guardRequest(request);
    const input = Input.parse(await jsonBody(request));
    return Response.json(await verifyExtraction(input.extraction, input.selectedId), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
