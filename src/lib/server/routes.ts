import { z } from 'zod';
import type { GooglePlace } from '../library-types';
import { distanceKm } from '../suggestions';
import type { PlanningPreferences } from '../planning';
import { ServiceError } from './errors';
import { charge } from './guards';
export interface TravelMatrix {
  minutes: number[][];
  source: 'google' | 'estimate';
  warnings: string[];
}
export function routesConfigured() {
  return (
    !!process.env.GOOGLE_ROUTES_API_KEY ||
    !!(process.env.GOOGLE_MAPS_API_KEY && process.env.PLANS_ENABLE_ROUTES === 'true')
  );
}
export async function getTravelMatrix(
  places: GooglePlace[],
  preferences: PlanningPreferences,
): Promise<TravelMatrix> {
  const key =
    process.env.GOOGLE_ROUTES_API_KEY ||
    (process.env.PLANS_ENABLE_ROUTES === 'true' ? process.env.GOOGLE_MAPS_API_KEY : undefined);
  if (!key) {
    const matrix = places.map((a) =>
      places.map((b) => {
        if (a.id === b.id) return 0;
        if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null)
          return Infinity;
        const km = distanceKm(
          { latitude: a.latitude, longitude: a.longitude },
          { latitude: b.latitude, longitude: b.longitude },
        );
        const speed =
          preferences.transport === 'Walking' ? 4 : preferences.transport === 'Driving' ? 20 : 12;
        return Math.ceil((km / speed) * 60 + 10);
      }),
    );
    return {
      minutes: matrix,
      source: 'estimate',
      warnings: [
        'Routes API is not configured. Travel uses straight-line distance with a buffer, not verified street routes. This is a provisional draft.',
      ],
    };
  }
  charge('google', places.length ** 2);
  let res: Response;
  try {
    res = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'originIndex,destinationIndex,status,condition,duration,distanceMeters',
      },
      body: JSON.stringify({
        origins: places.map((p) => ({ waypoint: { placeId: p.id } })),
        destinations: places.map((p) => ({ waypoint: { placeId: p.id } })),
        travelMode:
          preferences.transport === 'Walking'
            ? 'WALK'
            : preferences.transport === 'Driving'
              ? 'DRIVE'
              : 'TRANSIT',
        ...(preferences.transport === 'Driving' ? { routingPreference: 'TRAFFIC_UNAWARE' } : {}),
      }),
      signal: AbortSignal.timeout(20000),
      cache: 'no-store',
      redirect: 'error',
    });
  } catch {
    throw new ServiceError(
      'ROUTES_UNAVAILABLE',
      'Google Routes could not be reached. Try later; no travel times were invented.',
      502,
    );
  }
  if (!res.ok)
    throw new ServiceError(
      'ROUTES_REJECTED',
      'Google Routes rejected this request. Check the Routes API key, billing and API enablement.',
      res.status === 429 ? 429 : 502,
    );
  const parsed = z
    .array(
      z.object({
        originIndex: z.number().int().default(0),
        destinationIndex: z.number().int().default(0),
        condition: z.string().optional(),
        duration: z.string().optional(),
        status: z.object({ code: z.number().optional() }).optional(),
      }),
    )
    .parse(await res.json());
  const matrix = places.map((a, i) => places.map((_, j) => (i === j ? 0 : Infinity)));
  for (const row of parsed) {
    if (row.originIndex >= places.length || row.destinationIndex >= places.length) continue;
    if (
      row.condition === 'ROUTE_EXISTS' &&
      (!row.status?.code || row.status.code === 0) &&
      row.duration &&
      /^\d+(\.\d+)?s$/.test(row.duration)
    )
      matrix[row.originIndex][row.destinationIndex] = Math.ceil(parseFloat(row.duration) / 60);
  }
  return {
    minutes: matrix,
    source: 'google',
    warnings:
      preferences.transport === 'Public transit'
        ? [
            'Transit times are a current baseline, not a timetable for your selected departure date. Confirm the service; this is a provisional draft.',
          ]
        : ['Google route durations are planning estimates; allow for traffic, queues and delays.'],
  };
}
