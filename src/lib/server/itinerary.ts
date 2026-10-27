import type { z } from 'zod';
import { PlanningRequestSchema } from '../planning';
import { getPlaceDetails, searchPlaces } from './google-places';
import { rankActivities } from './openai';
import { getTravelMatrix } from './routes';
import { ServiceError } from './errors';
import { solveSchedule } from './scheduler';
export async function generateItinerary(input: z.infer<typeof PlanningRequestSchema>) {
  const { places, preferences, lockedIds, fixedOrder } = input;
  if (places.some((p) => p.sample))
    throw new ServiceError(
      'SAMPLE_MIX',
      'Keep illustrative sample places separate from verified real places. Use the sample planner for sample collections.',
    );
  if (places.some((p) => !p.googlePlaceId || !p.extraction?.name || !p.extraction?.city))
    throw new ServiceError(
      'UNVERIFIED_PLACES',
      'Confirm Google location matches for every selected place before generating a real itinerary.',
      422,
      ['Open My Places and review the locations marked “Needs review”.'],
    );
  if (new Set(places.map((p) => p.googlePlaceId)).size !== places.length)
    throw new ServiceError(
      'DUPLICATE_LOCATION',
      'Two saved videos refer to the same Google location. Choose one of them for this outing.',
    );
  const details = await Promise.all(places.map((p) => getPlaceDetails(p.googlePlaceId!)));
  if (details.some((p) => p.latitude == null || p.longitude == null))
    throw new ServiceError(
      'UNKNOWN_COORDINATES',
      'A selected listing has no usable coordinates. Choose a different location match.',
      422,
    );
  const requestedCity = preferences.city.split(',')[0].trim().toLocaleLowerCase();
  if (details.some((d) => d.city && d.city.trim().toLocaleLowerCase() !== requestedCity))
    throw new ServiceError(
      'CITY_MISMATCH',
      'The selected Google locations do not all match the chosen city. Select a collection in that city, or correct the plan’s city.',
      422,
    );
  let origin = undefined;
  if (preferences.startingLocation.trim()) {
    const matches = await searchPlaces(`${preferences.startingLocation}, ${preferences.city}`);
    const normalizeOrigin = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    const query = normalizeOrigin(preferences.startingLocation);
    if (
      matches.length !== 1 ||
      !(
        normalizeOrigin(matches[0].name) === query ||
        normalizeOrigin(matches[0].address) === query ||
        (normalizeOrigin(matches[0].address).includes(query) && query.length >= 12)
      )
    )
      throw new ServiceError(
        'START_AMBIGUOUS',
        'The starting location could not be identified uniquely. Use its full name and street address, or leave blank to start at the first stop.',
        422,
        matches.map((m) => `${m.name}: ${m.address}`),
      );
    origin = matches[0];
  }
  const ranking = await rankActivities(
    places.map((p) => ({
      id: p.id,
      name: p.extraction!.name!,
      category: p.extraction!.category,
      description: p.extraction!.description,
    })),
    preferences,
  );
  const ranked = ranking.priorities.map((r) => ({
    place: places.find((p) => p.id === r.placeId)!,
    details: details[places.findIndex((p) => p.id === r.placeId)],
    reason: r.reason,
  }));
  const allDetails = ranked.map((r) => r.details);
  if (origin) allDetails.push(origin);
  const travel = await getTravelMatrix(allDetails, preferences);
  const result = solveSchedule(
    ranked,
    preferences,
    travel,
    lockedIds,
    fixedOrder,
    origin ? ranked.length : undefined,
  );
  return { schedule: result, explanation: ranking.explanation };
}
