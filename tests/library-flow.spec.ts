import { test, expect, type Page } from '@playwright/test';
import { extraction, googlePlace } from './fixtures';
import { solveSchedule } from '../src/lib/server/scheduler';
import { PlanningRequestSchema } from '../src/lib/planning';
import { chooseMatch } from '../src/lib/server/google-places';
async function fixtureServices(page: Page) {
  await page.route('**/api/capabilities', (r) =>
    r.fulfill({ json: { ai: true, places: true, routes: true, video: true, maps: false } }),
  );
  await page.route('**/api/process', async (r) => {
    const body = r.request().postDataJSON();
    const name = body.context.includes('Gallery')
      ? 'Fixture Gallery'
      : body.context.includes('Ambiguous')
        ? 'Ambiguous Coffee'
        : 'Fixture Coffee';
    const value = extraction(name);
    const matches =
      name === 'Ambiguous Coffee'
        ? [googlePlace(name, 'fixture-branch-a'), googlePlace(name, 'fixture-branch-b')]
        : [googlePlace(name, name === 'Fixture Gallery' ? 'fixture-gallery' : 'fixture-coffee')];
    const match = chooseMatch(value, matches);
    await r.fulfill({
      json: { extraction: value, state: match.googlePlaceId ? 'ready' : 'needs_review', ...match },
    });
  });
  await page.route('**/api/verify', async (r) => {
    const body = r.request().postDataJSON();
    const match = googlePlace(body.extraction.name, body.selectedId || 'fixture-corrected');
    await r.fulfill({
      json: {
        verification: 'confirmed',
        googlePlaceId: match.id,
        matches: [match],
        message: 'Controlled fixture: user confirmed a match.',
      },
    });
  });
  await page.route('**/api/details', async (r) => {
    const { ids } = r.request().postDataJSON();
    await r.fulfill({
      json: {
        places: ids.map((id: string) =>
          googlePlace(id.includes('gallery') ? 'Fixture Gallery' : 'Fixture Coffee', id),
        ),
      },
    });
  });
  await page.route('**/api/itinerary', async (r) => {
    const input = PlanningRequestSchema.parse(r.request().postDataJSON());
    const candidates = input.places.map((p) => ({
      place: p,
      details: googlePlace(p.extraction!.name!, p.googlePlaceId!),
      reason: 'Controlled AI reasoning fixture; not a live model result.',
    }));
    try {
      const schedule = solveSchedule(
        candidates,
        input.preferences,
        {
          minutes: candidates.map((_, i) => candidates.map((__, j) => (i === j ? 0 : 12))),
          source: 'google',
          warnings: [],
        },
        input.lockedIds,
        input.fixedOrder,
      );
      await r.fulfill({
        json: {
          schedule,
          explanation:
            'Controlled end-to-end fixture. Scheduling uses the real deterministic solver.',
        },
      });
    } catch (e) {
      await r.fulfill({
        status: 422,
        json: {
          error: {
            code: 'NO_FEASIBLE_PLAN',
            message: e instanceof Error ? e.message : 'No plan fits',
            alternatives: ['Widen the time window or raise the budget.'],
          },
        },
      });
    }
  });
}
async function openImport(page: Page) {
  await page.getByRole('button', { name: 'Collect a place', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('library-first import, automatic organization, suggestions, planning, edits, regeneration and safe persistence', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await fixtureServices(page);
  await page.goto('/places');
  await expect(page.getByRole('heading', { name: 'My Places.' })).toBeVisible();
  await openImport(page);
  await page
    .getByLabel('Description or transcript', { exact: true })
    .fill(
      'Fixture Coffee in Test Harbor costs USD 12. A calm coffee stop.\n\nFixture Gallery in Test Harbor costs USD 12. An art activity.',
    );
  await page.getByRole('button', { name: 'Add to My Places', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.place-card').filter({ hasText: 'Fixture Coffee' })).toContainText(
    'Ready to plan',
  );
  await expect(page.locator('.place-card').filter({ hasText: 'Fixture Gallery' })).toContainText(
    'Ready to plan',
  );
  await page.getByRole('textbox', { name: 'Search My Places' }).fill('Fixture Coffee');
  await expect(page.locator('.place-card')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Search My Places' }).fill('');
  const before = await page.locator('.place-card').count();
  await openImport(page);
  await page
    .getByLabel('Description or transcript', { exact: true })
    .fill('Fixture Coffee in Test Harbor costs USD 12. A calm coffee stop.');
  await page.getByRole('button', { name: 'Add to My Places', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('duplicate');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.locator('.place-card')).toHaveCount(before);
  await page.goto('/');
  const suggestion = page.locator('.suggestion-card').filter({ hasText: 'Test Harbor' });
  await expect(suggestion).toHaveCount(1);
  await expect(suggestion).toContainText('2 saved places');
  await suggestion.getByRole('button', { name: 'Make a day of it' }).click();
  await page.getByLabel('When are you free?').fill('2026-11-21');
  await page.getByRole('button', { name: 'Generate my plan', exact: true }).click();
  await expect(page).toHaveURL(/\/itinerary$/);
  await expect(page.locator('.stop-card')).toHaveCount(2);
  await expect(page.locator('.itinerary-notice')).toContainText('passed');
  const planUrl = page.url();
  await page.getByRole('button', { name: 'Lock Fixture Coffee', exact: true }).click();
  await page.getByRole('button', { name: 'Move Fixture Gallery up', exact: true }).isDisabled();
  await page.getByRole('link', { name: 'Your preferences', exact: true }).click();
  await page.getByLabel('Budget per person').fill('5');
  await page.getByRole('button', { name: 'Generate my itinerary', exact: true }).click();
  await expect(page.locator('.field-error')).toContainText('must-visit');
  await page.getByLabel('Budget per person').fill('50');
  await page.getByRole('button', { name: 'Generate my itinerary', exact: true }).click();
  await expect(page).toHaveURL(/\/itinerary$/);
  await expect(
    page.getByRole('button', { name: 'Unlock Fixture Coffee', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Remove stop Fixture Gallery', exact: true }).click();
  await expect(page.locator('.stop-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Check edited order' })).toBeVisible();
  await page.getByRole('button', { name: 'Check edited order' }).click();
  await expect(page.getByRole('button', { name: 'Check edited order' })).toHaveCount(0);
  await expect(page.locator('.stop-card')).toHaveCount(1);
  const storage = await page.evaluate(() => ({
    places: JSON.parse(localStorage.getItem('tiktok-plans:places:v1') || '[]'),
    plans: JSON.parse(localStorage.getItem('tiktok-plans:v1') || '[]'),
  }));
  expect(storage.places.filter((p: { sample: boolean }) => !p.sample)).toHaveLength(2);
  expect(JSON.stringify(storage)).not.toContain('Fixture Street');
  expect(JSON.stringify(storage)).not.toContain('latitude');
  expect(storage.plans.find((p: { mode: string }) => p.mode === 'live').schedule).toBeUndefined();
  await page.reload();
  await expect(page.locator('.itinerary-notice')).toContainText('not retained');
  await expect(
    page.getByRole('button', { name: 'Unlock Fixture Coffee', exact: true }),
  ).toBeVisible();
  await page.goto('/places');
  await expect(page.locator('.place-card').filter({ hasText: 'Fixture Gallery' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Review Fixture Gallery', exact: true }).click();
  await page.getByLabel('Place name', { exact: true }).fill('Fixture Gallery Annex');
  await page.getByRole('button', { name: 'Save corrections', exact: true }).click();
  await expect(
    page.locator('.place-card').filter({ hasText: 'Fixture Gallery Annex' }),
  ).toContainText('Ready to plan');
  await page.getByRole('button', { name: 'Review Fixture Gallery Annex', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, delete place', exact: true }).click();
  await expect(
    page.locator('.place-card').filter({ hasText: 'Fixture Gallery Annex' }),
  ).toHaveCount(0);
  await page.goto(planUrl);
  await expect(page.locator('.stop-card')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('ambiguous businesses require a deliberate Google match choice', async ({ page }) => {
  await fixtureServices(page);
  await page.goto('/places');
  await expect(page.locator('.place-card')).toHaveCount(5);
  await openImport(page);
  await page
    .getByLabel('Description or transcript', { exact: true })
    .fill('Ambiguous Coffee in Test Harbor, USD 12.');
  await page.getByRole('button', { name: 'Add to My Places', exact: true }).click();
  const card = page.locator('.place-card').filter({ hasText: 'Ambiguous Coffee' });
  await expect(card).toContainText('Needs your eye');
  await page.getByRole('button', { name: 'Review Ambiguous Coffee', exact: true }).click();
  await expect(page.locator('.match-list>div')).toHaveCount(2);
  await page.getByRole('button', { name: 'This one', exact: true }).nth(1).click();
  await expect(page.getByRole('dialog')).toContainText('Google location');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(card).toContainText('Ready to plan');
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('tiktok-plans:places:v1') || '[]'),
  );
  expect(
    stored.find(
      (p: { extraction?: { name?: string } }) => p.extraction?.name === 'Ambiguous Coffee',
    ).googlePlaceId,
  ).toBe('fixture-branch-b');
});

test('invalid and duplicate links, link-only clarification, and missing keys preserve collected content', async ({
  page,
  request,
}) => {
  const caps = await (await request.get('/api/capabilities')).json();
  await page.goto('/places');
  await expect(page.locator('.place-card')).toHaveCount(5);
  await openImport(page);
  await page.getByLabel('TikTok links', { exact: false }).fill('https://example.com/not-tiktok');
  await page.getByRole('button', { name: 'Add to My Places', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Only HTTPS TikTok');
  await page
    .getByLabel('TikTok links', { exact: false })
    .fill(
      'https://www.tiktok.com/@fixture/video/999?tracking=a\nhttps://www.tiktok.com/@fixture/video/999?tracking=b',
    );
  await page.getByRole('button', { name: 'Add to My Places', exact: true }).click();
  await expect(page.locator('.place-card')).toHaveCount(6);
  await expect(
    page.locator('.place-card').filter({ hasText: 'A new place to discover' }),
  ).toContainText('link alone');
  const noContent = await request.post('/api/process', {
    data: { sourceUrl: 'https://www.tiktok.com/@fixture/video/888', context: '' },
  });
  expect(noContent.status()).toBe(200);
  expect((await noContent.json()).state).toBe('needs_review');
  if (!caps.ai) {
    const missing = await request.post('/api/process', {
      data: { context: 'A place described in a transcript.', sourceUrl: '' },
    });
    expect(missing.status()).toBe(503);
    expect((await missing.json()).error.code).toBe('AI_NOT_CONFIGURED');
    await openImport(page);
    await page
      .getByLabel('Description or transcript', { exact: true })
      .fill('A café in a city, no key configured.');
    await page.getByRole('button', { name: 'Add to My Places', exact: true }).click();
    await expect(
      page.locator('.place-card').filter({ hasText: 'no key configured' }),
    ).toContainText('PLANS_OPENAI_API_KEY');
    await page.reload();
    await expect(page.locator('.place-card').filter({ hasText: 'no key configured' })).toHaveCount(
      1,
    );
  }
  const malformed = await request.post('/api/process', {
    data: { sourceUrl: 'https://private.example/video', context: 'Test' },
  });
  expect(malformed.status()).toBe(400);
  const denied = await request.post('/api/process', {
    headers: { Origin: 'https://another-origin.example' },
    data: { context: 'Test' },
  });
  expect(denied.status()).toBe(403);
});
