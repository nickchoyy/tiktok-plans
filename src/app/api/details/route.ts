import { z } from 'zod';
import { getPlaceDetails } from '@/lib/server/google-places';
import { guardRequest, jsonBody } from '@/lib/server/guards';
import { errorResponse } from '@/lib/server/errors';
export async function POST(request: Request) {
  try {
    guardRequest(request);
    const { ids } = z
      .object({ ids: z.array(z.string().max(300)).min(1).max(10) })
      .parse(await jsonBody(request));
    const places = await Promise.all([...new Set(ids)].map(getPlaceDetails));
    return Response.json({ places }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
