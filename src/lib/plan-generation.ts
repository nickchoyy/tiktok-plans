import { ClientError } from './api-client';
import { apiRequest } from './api-client';
import { ScheduleResultSchema, type SavedPlace } from './library-types';
import { PlanningPreferencesSchema } from './planning';
import { mockItineraryService } from './services';
import { placeToVideo } from './library-storage';
import type { Plan, Preferences, Stop } from './types';
import { z } from 'zod';
export async function generateFromLibrary(
  places: SavedPlace[],
  preferences: Preferences,
  existingStops: Stop[] = [],
  fixedOrder?: string[],
): Promise<Pick<Plan, 'stops' | 'schedule' | 'planningExplanation' | 'scheduleStale' | 'status'>> {
  if (!places.length || places.length > 6)
    throw new ClientError('Choose between one and six saved places for an outing.');
  if (places.some((p) => p.sample) && places.some((p) => !p.sample))
    throw new ClientError(
      'Keep sample places separate from your real collection. Select one kind of collection.',
    );
  const validation = PlanningPreferencesSchema.safeParse({
    ...preferences,
    endTime: preferences.endTime || '17:00',
    startingLocation: preferences.startingLocation || '',
    allowUnknownCosts: preferences.allowUnknownCosts || false,
    allowRegularHours: preferences.allowRegularHours || false,
  });
  if (!validation.success)
    throw new ClientError(validation.error.issues[0]?.message || 'Check the plan preferences.');
  const parsed = validation.data;
  if (places.every((p) => p.sample)) {
    const stops = await mockItineraryService.generate({
      videos: places.map(placeToVideo),
      preferences,
      existingStops,
    });
    return {
      stops,
      status: 'Ready to go',
      scheduleStale: false,
      planningExplanation:
        'Illustrative sample only. No real locations, opening hours, prices, routes or AI were used.',
    };
  }
  const raw = await apiRequest('/api/itinerary', {
    places,
    preferences: parsed,
    lockedIds: existingStops.filter((s) => s.locked).map((s) => s.videoId),
    fixedOrder,
  });
  const result = z.object({ schedule: ScheduleResultSchema, explanation: z.string() }).parse(raw);
  const stops = result.schedule.visits.map(
    (v) =>
      existingStops.find((s) => s.videoId === v.placeId) || {
        id: crypto.randomUUID(),
        videoId: v.placeId,
        locked: false,
        votes: [],
      },
  );
  return {
    stops,
    schedule: result.schedule,
    planningExplanation: result.explanation,
    scheduleStale: false,
    status: result.schedule.quality === 'checked' ? 'Ready to go' : 'Draft',
  };
}
export async function regenerateExistingPlan(
  plan: Plan,
  library: SavedPlace[],
  fixedOrder?: string[],
) {
  if (plan.mode !== 'live') {
    return {
      stops: await mockItineraryService.generate({
        videos: plan.videos,
        preferences: plan.preferences,
        existingStops: plan.stops,
      }),
      status: 'Ready to go' as const,
      scheduleStale: false,
    };
  }
  const ids = plan.placeIds || plan.videos.map((v) => v.placeId || v.id);
  if (ids.some((id) => !library.some((p) => p.id === id)))
    throw new Error(
      'A place in this plan has been deleted from My Places. Remove it from this plan or restore/re-import it before generating again.',
    );
  return generateFromLibrary(
    ids.map((id) => library.find((p) => p.id === id)!),
    plan.preferences,
    plan.stops,
    fixedOrder,
  );
}
