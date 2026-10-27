import { PlanningRequestSchema } from '@/lib/planning';
import { generateItinerary } from '@/lib/server/itinerary';
import { guardRequest, jsonBody, withProcessingSlot } from '@/lib/server/guards';
import { errorResponse } from '@/lib/server/errors';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    guardRequest(request);
    const input = PlanningRequestSchema.parse(await jsonBody(request));
    return await withProcessingSlot(async () =>
      Response.json(await generateItinerary(input), { headers: { 'Cache-Control': 'no-store' } }),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
