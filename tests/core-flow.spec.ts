import { test, expect } from '@playwright/test';
test('complete plan flow persists preferences, stops, crew, and votes', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Your next good plan starts here.' }),
  ).toBeVisible();
  await page
    .locator('.plans-section')
    .getByRole('button', { name: 'Create a plan', exact: true })
    .click();
  await page.getByLabel('Plan name', { exact: true }).fill('Coffee and coast with friends');
  await page.getByRole('button', { name: 'Let’s make a plan' }).click();
  await expect(page).toHaveURL(/\/videos$/);
  await expect(page.getByRole('link', { name: 'Make it your kind of day' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add A slow morning at Dayglow', exact: true }).click();
  await page
    .getByRole('button', { name: 'Add A coastal walk, a very good idea', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Add The little pasta spot worth finding', exact: true })
    .click();
  await page.getByLabel('Paste a TikTok link').fill('https://example.com/wrong');
  await page.getByRole('button', { name: 'Add video', exact: true }).click();
  await expect(page.locator('#url-error')).toContainText('valid HTTPS TikTok');
  await page.getByLabel('Paste a TikTok link').fill('https://www.tiktok.com/@sample/video/123456');
  await page.getByRole('button', { name: 'Add video', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'A new place to discover', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Make it your kind of day' }).click();
  await page.getByLabel('City or neighborhood').fill('San Francisco, CA');
  await page.getByLabel('Date', { exact: true }).fill('2026-11-21');
  await page.getByLabel('Start time').fill('10:30');
  await page.getByLabel('Budget per person').fill('65');
  await page.getByRole('radio', { name: 'Public transit' }).check({ force: true });
  await page.getByRole('radio', { name: 'A little of everything' }).check();
  await page.getByRole('button', { name: 'Build my sample itinerary' }).click();
  await expect(page).toHaveURL(/\/itinerary$/);
  await expect(
    page.getByRole('heading', { name: 'A slow morning at Dayglow', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.stop-card')).toHaveCount(4);
  await expect(page.locator('.stop-time').first()).toContainText('10:30 AM');
  const first = page.locator('.stop-card').first();
  await page
    .getByRole('button', { name: 'Move A slow morning at Dayglow down', exact: true })
    .click();
  await expect(first).toContainText('A coastal walk');
  await page.getByRole('button', { name: 'Lock A slow morning at Dayglow', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Remove stop A slow morning at Dayglow', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Refresh sample plan' }).click();
  await expect(page.getByRole('button', { name: 'Refresh sample plan' })).toBeEnabled();
  await expect(page.locator('.stop-card').nth(1)).toContainText('A slow morning');
  await page
    .getByRole('button', { name: 'Remove stop A new place to discover', exact: true })
    .click();
  await expect(page.locator('.stop-card')).toHaveCount(3);
  await page.getByRole('link', { name: 'Bring your people' }).click();
  await page.getByRole('button', { name: 'Add a friend' }).click();
  await page.getByLabel('Friend’s name').fill('Taylor Lee');
  await page.getByRole('button', { name: 'Add to local crew' }).click();
  await expect(page.getByText('Taylor Lee', { exact: true })).toBeVisible();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy plan summary' }).click();
  await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    'Coffee and coast with friends',
  );
  const vote = page.getByRole('button', {
    name: 'Vote for A slow morning at Dayglow',
    exact: true,
  });
  await vote.click();
  await expect(vote).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByText('Taylor Lee', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Vote for A slow morning at Dayglow', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'Back to the itinerary', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Unlock A slow morning at Dayglow', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.stop-time').first()).toContainText('10:30 AM');
  await page.getByRole('link', { name: 'All plans', exact: true }).click();
  await page.getByRole('button', { name: 'Drafts', exact: true }).click();
  await expect(
    page.locator('.plan-card').filter({ hasText: 'Coffee and coast with friends' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'All plans', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search plans' }).fill('Coffee and coast');
  await expect(page.locator('.plan-card')).toHaveCount(1);
  await expect(page.locator('.plan-card')).toContainText('Coffee and coast with friends');
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});
test('dashboard, empty results, keyboard controls, and inspiration render without broken assets', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(page.locator('.plan-card')).toHaveCount(3);
  await page.screenshot({ path: `/tmp/tiktok-plans-${testInfo.project.name}.png`, fullPage: true });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  const broken = await page
    .locator('img')
    .evaluateAll((imgs) =>
      imgs
        .filter((i) => i instanceof HTMLImageElement && (!i.complete || i.naturalWidth === 0))
        .map((i) => (i as HTMLImageElement).src),
    );
  expect(broken).toEqual([]);
  await page.getByRole('textbox', { name: 'Search plans' }).fill('nothing matches here');
  await expect(page.getByRole('heading', { name: 'No plans found' })).toBeVisible();
  await page.goto('/plans/weekend-in-sf/itinerary');
  await expect(page.locator('.stop-card')).toHaveCount(3);
  const handle = page.getByRole('button', {
    name: 'Reorder A slow morning at Dayglow',
    exact: true,
  });
  await handle.focus();
  await page.keyboard.press('Space');
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('status').filter({ hasText: 'was moved over droppable area stop-v2' }),
  ).toHaveCount(1);
  await page.keyboard.press('Space');
  await expect(page.locator('.stop-card').first()).toContainText(
    'The little pasta spot worth finding',
  );
  // Exercise pointer dragging as well as the keyboard and arrow-button paths.
  // Hover waits for the previous sortable animation to settle before measuring.
  await handle.hover();
  const origin = await handle.boundingBox();
  const sourceCard = await page.locator('.stop-card').nth(1).boundingBox();
  const destination = await page.locator('.stop-card').first().boundingBox();
  expect(origin).not.toBeNull();
  expect(sourceCard).not.toBeNull();
  expect(destination).not.toBeNull();
  await page.mouse.move(origin!.x + origin!.width / 2, origin!.y + origin!.height / 2);
  await page.mouse.down();
  await page.mouse.move(origin!.x + origin!.width / 2, origin!.y + origin!.height / 2 - 12);
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(
    origin!.x + origin!.width / 2,
    origin!.y + origin!.height / 2 + destination!.y - sourceCard!.y,
    { steps: 12 },
  );
  await expect(
    page.getByRole('status').filter({ hasText: 'was moved over droppable area stop-v2' }),
  ).toHaveCount(1);
  await page.mouse.up();
  await expect(page.locator('.stop-card').first()).toContainText('A slow morning at Dayglow');
  await page.goto('/videos');
  await expect(page.getByRole('heading', { name: 'My Places.' })).toBeVisible();
  await page.getByRole('button', { name: 'Your collection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nothing here, just yet.' })).toBeVisible();
});
test('unavailable or corrupt storage has an actionable error state', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tiktok-plans:v1', '{invalid'));
  await page.goto('/');
  await expect(page.locator('.error-banner')).toContainText('couldn’t load saved plans');
  await expect(
    page.getByRole('heading', { name: 'A little possibility, right here.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry save' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry save' }).click();
  await expect(page.locator('.error-banner')).toContainText('still unavailable or unreadable');
  expect(await page.evaluate(() => localStorage.getItem('tiktok-plans:v1'))).toBe('{invalid');
});
