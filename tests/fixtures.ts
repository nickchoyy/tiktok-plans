// Controlled fixtures only. These are NOT live OpenAI outputs or real Google listings.
import type { Extraction, GooglePlace, SavedPlace } from '../src/lib/library-types';
import type { PlanningPreferences } from '../src/lib/planning';
export function extraction(name = 'Fixture Coffee'): Extraction {
  return {
    name,
    city: 'Test Harbor',
    neighborhood: 'Central',
    category: 'Coffee',
    description: 'A controlled test experience, not a real recommendation.',
    durationMinutes: 40,
    cost: { amount: 12, currency: 'USD', evidence: 'USD 12' },
    confidence: 0.9,
    evidence: ['Fixture Coffee in Test Harbor'],
    missingInfo: [],
  };
}
export function googlePlace(name = 'Fixture Coffee', id = 'fixture-coffee'): GooglePlace {
  return {
    id,
    name,
    city: 'Test Harbor',
    address: '12 Fixture Street, Test Harbor (test data)',
    latitude: 37.77,
    longitude: -122.42,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query_place_id=${id}&query=test`,
    periods: [{ open: { day: 0, hour: 0, minute: 0 } }],
    currentPeriods: [
      {
        open: { day: 6, hour: 9, minute: 0, date: { year: 2026, month: 11, day: 21 } },
        close: { day: 6, hour: 19, minute: 0, date: { year: 2026, month: 11, day: 21 } },
      },
    ],
    weekdayDescriptions: ['Test fixtures: 9 AM–7 PM'],
    businessStatus: 'OPERATIONAL',
    attributions: [],
  };
}
export function savedPlace(id = 'p1', name = 'Fixture Coffee'): SavedPlace {
  return {
    id,
    sourceUrl: 'https://www.tiktok.com/@fixture/video/12345',
    sourceKind: 'description',
    context: `${name} in Test Harbor costs USD 12`,
    duplicateKey: id,
    state: 'ready',
    stage: 'Controlled test fixture',
    extraction: extraction(name),
    googlePlaceId: 'fixture-' + id,
    verification: 'matched',
    error: null,
    image: '/images/cafe.png',
    sample: false,
    createdAt: '2026-10-27T12:00:00Z',
  };
}
export const planningPreferences: PlanningPreferences = {
  city: 'Test Harbor',
  date: '2026-11-21',
  time: '10:00',
  endTime: '15:00',
  budget: '50',
  transport: 'Walking',
  pace: 'Easygoing',
  startingLocation: '',
  allowUnknownCosts: false,
  allowRegularHours: false,
};
