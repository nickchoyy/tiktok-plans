import { test, expect } from '@playwright/test';
import { chooseMatch } from '../src/lib/server/google-places';
import { processContent } from '../src/lib/server/pipeline';
import { solveSchedule, openingWindows } from '../src/lib/server/scheduler';
import { ExtractionSchema, PlaceSchema } from '../src/lib/library-types';
import { PlanningRequestSchema } from '../src/lib/planning';
import { buildSuggestions } from '../src/lib/suggestions';
import { normalizeTikTokUrl } from '../src/lib/imports';
import { extraction, googlePlace, savedPlace, planningPreferences } from './fixtures';
const candidates = () =>
  [savedPlace('p1'), savedPlace('p2', 'Fixture Gallery')].map((place, i) => ({
    place,
    details: googlePlace(place.extraction!.name!, `fixture-${place.id}`),
    reason: `Controlled AI ranking ${i}`,
  }));
const travel = {
  minutes: [
    [0, 15],
    [15, 0],
  ],
  source: 'google' as const,
  warnings: [],
};
test('pipeline extracts with schema validation and verifies, without an implicit TikTok fetch', async () => {
  let extracted = 0,
    verified = 0;
  const output = await processContent(
    { context: 'Fixture Coffee in Test Harbor. USD 12.' },
    {
      extract: async () => {
        extracted++;
        return ExtractionSchema.parse(extraction());
      },
      verify: async (e) => {
        verified++;
        return chooseMatch(e, [googlePlace()]);
      },
      transcribe: async () => {
        throw new Error('No audio supplied');
      },
    },
  );
  expect(output.state).toBe('ready');
  expect(output.googlePlaceId).toBe('fixture-coffee');
  expect(extracted).toBe(1);
  expect(verified).toBe(1);
  const bare = await processContent(
    { context: '' },
    {
      extract: async () => {
        throw new Error('Must not invent content from a link');
      },
      verify: async () => {
        throw new Error('Must not verify invented content');
      },
      transcribe: async () => '',
    },
  );
  expect(bare.state).toBe('needs_review');
  expect(bare.extraction).toBeNull();
});
test('ambiguity and low-confidence extraction require confirmation', async () => {
  expect(
    chooseMatch(extraction(), [googlePlace(), googlePlace('Fixture Coffee', 'other-branch')])
      .verification,
  ).toBe('ambiguous');
  expect(chooseMatch(extraction(), [googlePlace('Different Name')]).googlePlaceId).toBeNull();
  const result = await processContent(
    { context: 'Something unclear' },
    {
      extract: async () => ({ ...extraction(), confidence: 0.2, city: null }),
      verify: async () => {
        throw new Error('Must not auto-verify low confidence');
      },
      transcribe: async () => '',
    },
  );
  expect(result.state).toBe('needs_review');
});
test('scheduler honors hours, cost, travel, AI priorities, and must-visit membership', () => {
  const c = candidates();
  c[1].details.currentPeriods[0].open.hour = 12;
  const result = solveSchedule(c, planningPreferences, travel, ['p2']);
  expect(result.visits).toHaveLength(2);
  const second = result.visits.find((v) => v.placeId === 'p2')!;
  expect(second.arrival).toBeGreaterThanOrEqual(720);
  expect(second.travelMinutes).toBe(15);
  expect(result.totalCost).toBe(24);
  expect(result.quality).toBe('checked');
  expect(result.visits.some((v) => v.placeId === 'p2')).toBeTruthy();
});
test('impossible locks and budgets fail with alternatives; unlocked stops may be omitted', () => {
  const c = candidates();
  expect(() => solveSchedule(c, { ...planningPreferences, budget: '1' }, travel, ['p1'])).toThrow(
    'must-visit',
  );
  expect(() =>
    solveSchedule(c, { ...planningPreferences, time: '16:00', endTime: '15:00' }, travel, []),
  ).toThrow('end time');
  c[0].place.extraction!.cost!.amount = 100;
  const reduced = solveSchedule(c, planningPreferences, travel, []);
  expect(reduced.visits.map((v) => v.placeId)).toEqual(['p2']);
  expect(reduced.omitted[0].placeId).toBe('p1');
  expect(() => solveSchedule(c, planningPreferences, travel, ['p1'])).toThrow('must-visit');
});
test('unconfirmed hours, unknown costs, and missing routes are not falsely verified', () => {
  const c = candidates();
  c[0].details.currentPeriods = [];
  c[1].details.currentPeriods = [];
  expect(() => solveSchedule(c, planningPreferences, travel, [])).toThrow('No saved activity');
  const provisional = solveSchedule(
    c,
    { ...planningPreferences, allowRegularHours: true },
    { ...travel, source: 'estimate' },
    [],
  );
  expect(provisional.quality).toBe('provisional');
  c[0].place.extraction!.cost = null;
  const unknown = solveSchedule(
    c,
    { ...planningPreferences, allowRegularHours: true, allowUnknownCosts: true },
    travel,
    [],
  );
  expect(unknown.totalCost).toBeNull();
  expect(unknown.quality).toBe('provisional');
  expect(() =>
    solveSchedule(
      c,
      { ...planningPreferences, allowRegularHours: true },
      {
        ...travel,
        minutes: [
          [0, Infinity],
          [Infinity, 0],
        ],
      },
      ['p1', 'p2'],
    ),
  ).toThrow();
});
test('date-specific availability and overnight published hours are handled deterministically', () => {
  const c = candidates()[0];
  c.place.confirmedHours = { date: '2026-11-21', start: '14:00', end: '15:00' };
  expect(openingWindows(c, '2026-11-21').windows).toEqual([[840, 900]]);
  c.place.confirmedHours = null;
  c.details.currentPeriods = [];
  c.details.periods = [
    { open: { day: 5, hour: 22, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } },
  ];
  expect(openingWindows(c, '2026-11-21', true).windows).toContainEqual([0, 120]);
});
test('suggestions depend on library contents, geography and sample separation', () => {
  expect(buildSuggestions([])).toEqual([]);
  const a = savedPlace('a'),
    b = savedPlace('b');
  b.sample = true;
  expect(buildSuggestions([a, b])).toHaveLength(2);
  b.sample = false;
  const one = buildSuggestions([a, b]);
  expect(one).toHaveLength(1);
  expect(one[0].placeIds).toEqual(['a', 'b']);
  const far = googlePlace('Far', 'fixture-b');
  far.latitude = 40;
  expect(buildSuggestions([a, b], { a: googlePlace(), b: far })).toHaveLength(2);
  expect(buildSuggestions([a])).toHaveLength(1);
});
test('input validation rejects profiles, unsafe hosts, invalid dates and unsupported fields', () => {
  expect(normalizeTikTokUrl('https://www.tiktok.com/@a/video/123?utm_source=x#fragment')).toBe(
    'https://www.tiktok.com/@a/video/123',
  );
  for (const link of [
    'http://www.tiktok.com/@a/video/1',
    'https://tiktok.com.evil.test/@a/video/1',
    'https://www.tiktok.com/@profile',
    'https://user:pass@www.tiktok.com/@a/video/1',
  ])
    expect(() => normalizeTikTokUrl(link)).toThrow();
  expect(
    PlanningRequestSchema.safeParse({
      places: [savedPlace()],
      preferences: { ...planningPreferences, date: '2026-02-31' },
    }).success,
  ).toBeFalsy();
  const sanitized = PlaceSchema.parse({
    ...savedPlace(),
    latitude: 1,
    address: 'Google content must not persist',
  });
  expect('latitude' in sanitized).toBeFalsy();
  expect('address' in sanitized).toBeFalsy();
});
