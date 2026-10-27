import { z } from 'zod';
import type { Extraction, GooglePlace, VerificationResult } from '../library-types';
import { charge } from './guards';
import { ServiceError } from './errors';
const PointSchema = z.object({
  day: z.number().int().min(0).max(6).default(0),
  hour: z.number().int().min(0).max(23).default(0),
  minute: z.number().int().min(0).max(59).default(0),
  date: z.object({ year: z.number(), month: z.number(), day: z.number() }).optional(),
});
const HoursSchema = z.object({
  periods: z.array(z.object({ open: PointSchema, close: PointSchema.optional() })).default([]),
  weekdayDescriptions: z.array(z.string()).default([]),
});
const GoogleSchema = z.object({
  id: z.string(),
  displayName: z.object({ text: z.string() }).optional(),
  formattedAddress: z.string().optional(),
  location: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
  addressComponents: z
    .array(
      z.object({
        longText: z.string().optional(),
        shortText: z.string().optional(),
        types: z.array(z.string()),
      }),
    )
    .optional(),
  regularOpeningHours: HoursSchema.optional(),
  currentOpeningHours: HoursSchema.optional(),
  googleMapsUri: z.string().optional(),
  businessStatus: z.string().optional(),
  attributions: z
    .array(z.object({ provider: z.string().optional(), providerUri: z.string().optional() }))
    .optional(),
});
const fields =
  'id,displayName,formattedAddress,location,addressComponents,regularOpeningHours,currentOpeningHours,googleMapsUri,businessStatus,attributions';
function key() {
  const value = process.env.GOOGLE_MAPS_API_KEY;
  if (!value)
    throw new ServiceError(
      'GOOGLE_NOT_CONFIGURED',
      'Google Places is not configured. Add GOOGLE_MAPS_API_KEY on the server to verify real locations.',
      503,
    );
  return value;
}
function normalize(raw: unknown): GooglePlace {
  const p = GoogleSchema.parse(raw);
  return {
    id: p.id,
    name: p.displayName?.text || 'Unnamed Google result',
    address: p.formattedAddress || 'Address unavailable',
    city:
      p.addressComponents?.find((c) => c.types.some((t) => ['locality', 'postal_town'].includes(t)))
        ?.longText ?? null,
    latitude: p.location?.latitude ?? null,
    longitude: p.location?.longitude ?? null,
    mapsUrl:
      p.googleMapsUri ||
      `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(p.id)}&query=${encodeURIComponent(p.displayName?.text || 'place')}`,
    periods: p.regularOpeningHours?.periods || [],
    currentPeriods: p.currentOpeningHours?.periods || [],
    weekdayDescriptions: p.regularOpeningHours?.weekdayDescriptions || [],
    businessStatus: p.businessStatus ?? null,
    attributions: (p.attributions || []).map((a) => ({
      name: a.provider || 'Google Maps',
      uri: a.providerUri || 'https://maps.google.com',
    })),
  };
}
async function googleFetch(path: string, mask: string, body?: unknown) {
  const apiKey = key();
  charge('google');
  let res: Response;
  try {
    res = await fetch(`https://places.googleapis.com/v1/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': mask,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
      redirect: 'error',
    });
  } catch {
    throw new ServiceError(
      'GOOGLE_UNAVAILABLE',
      'Google Places could not be reached. Your content is saved; try verification again later.',
      502,
    );
  }
  if (!res.ok)
    throw new ServiceError(
      'GOOGLE_REJECTED',
      'Google Places rejected the request. Check the server key, billing, API enablement, and restrictions.',
      res.status === 429 ? 429 : 502,
    );
  return res.json();
}
export async function searchPlaces(query: string): Promise<GooglePlace[]> {
  const response = await googleFetch(
    'places:searchText',
    fields
      .split(',')
      .map((f) => `places.${f}`)
      .join(','),
    { textQuery: query, pageSize: 3, languageCode: 'en' },
  );
  return (
    z
      .object({ places: z.array(z.unknown()).optional() })
      .parse(response)
      .places?.map(normalize) || []
  );
}
export async function getPlaceDetails(id: string): Promise<GooglePlace> {
  if (!/^[A-Za-z0-9_-]{5,300}$/.test(id))
    throw new ServiceError('INVALID_PLACE_ID', 'Choose a valid Google Place match.');
  return normalize(await googleFetch(`places/${encodeURIComponent(id)}`, fields));
}
const clean = (s: string) =>
  s
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
export function chooseMatch(extraction: Extraction, matches: GooglePlace[]): VerificationResult {
  if (!matches.length)
    return {
      verification: 'not_found',
      googlePlaceId: null,
      matches: [],
      message:
        'No matching business was found. Check the name and city, then save corrections to retry.',
    };
  const exact = matches.filter(
    (p) =>
      p.businessStatus !== 'CLOSED_PERMANENTLY' &&
      p.businessStatus !== 'CLOSED_TEMPORARILY' &&
      clean(p.name) === clean(extraction.name || '') &&
      !!p.city &&
      clean(p.city) === clean((extraction.city || '').split(',')[0]) &&
      p.latitude != null &&
      p.longitude != null,
  );
  if (
    exact.length === 1 &&
    matches.filter((p) => clean(p.name) === clean(extraction.name || '')).length === 1
  )
    return {
      verification: 'matched',
      googlePlaceId: exact[0].id,
      matches: [exact[0]],
      message:
        'Name and city matched a Google Places listing. Check the venue details before going.',
    };
  return {
    verification: 'ambiguous',
    googlePlaceId: null,
    matches,
    message:
      'More context or a location choice is needed. Confirm the correct listing below; no location was assumed.',
  };
}
export async function verifyExtraction(
  extraction: Extraction,
  selectedId?: string,
): Promise<VerificationResult> {
  if (!process.env.GOOGLE_MAPS_API_KEY)
    return {
      verification: 'unavailable',
      googlePlaceId: null,
      matches: [],
      message:
        'Google Places is not configured. The extracted details are saved, but the real location is unverified.',
    };
  if (selectedId) {
    const p = await getPlaceDetails(selectedId);
    if (
      p.latitude == null ||
      p.longitude == null ||
      p.businessStatus === 'CLOSED_PERMANENTLY' ||
      p.businessStatus === 'CLOSED_TEMPORARILY'
    )
      throw new ServiceError(
        'PLACE_UNAVAILABLE',
        'This listing has no usable location or is marked closed. Choose another match.',
      );
    return {
      verification: 'confirmed',
      googlePlaceId: p.id,
      matches: [p],
      message:
        'You confirmed this Google listing. Opening hours and travel still need checking for your plan.',
    };
  }
  if (!extraction.name || !extraction.city)
    return {
      verification: 'unverified',
      googlePlaceId: null,
      matches: [],
      message: 'Add the place name and city before verifying its real location.',
    };
  return chooseMatch(
    extraction,
    await searchPlaces(
      `${extraction.name}, ${extraction.city}${extraction.neighborhood ? ', ' + extraction.neighborhood : ''}`,
    ),
  );
}
