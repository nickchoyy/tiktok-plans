import { z } from 'zod';
import { jsonBody, guardRequest, charge } from '@/lib/server/guards';
import { errorResponse, ServiceError } from '@/lib/server/errors';
import { getPlaceDetails } from '@/lib/server/google-places';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    guardRequest(request);
    if (!process.env.GOOGLE_MAPS_API_KEY || process.env.PLANS_ENABLE_STATIC_MAPS !== 'true')
      throw new ServiceError(
        'MAP_NOT_CONFIGURED',
        'Enable the server-side Maps Static API to load a map. Google Maps links still work.',
        503,
      );
    const { ids } = z
      .object({ ids: z.array(z.string().max(300)).min(1).max(6) })
      .parse(await jsonBody(request));
    const places = await Promise.all([...new Set(ids)].map(getPlaceDetails));
    if (places.some((p) => p.latitude == null || p.longitude == null))
      throw new ServiceError(
        'MAP_LOCATION_MISSING',
        'A stop has no usable coordinates. Confirm its Google location.',
      );
    charge('google');
    const url = new URL('https://maps.googleapis.com/maps/api/staticmap');
    url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY);
    url.searchParams.set('size', '640x400');
    url.searchParams.set('scale', '2');
    url.searchParams.set('maptype', 'roadmap');
    url.searchParams.set('format', 'png');
    places.forEach((p, i) =>
      url.searchParams.append(
        'markers',
        `color:0x73518e|label:${i + 1}|${p.latitude},${p.longitude}`,
      ),
    );
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/'))
      throw new ServiceError(
        'MAP_UNAVAILABLE',
        'Google could not return a map. Check that Maps Static API is enabled for the server key.',
        502,
      );
    return new Response(await response.arrayBuffer(), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
