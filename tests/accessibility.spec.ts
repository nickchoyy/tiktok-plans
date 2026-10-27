import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.use({ reducedMotion: 'reduce' });
for (const route of [
  '/',
  '/places',
  '/plans/weekend-in-sf/videos',
  '/plans/weekend-in-sf/preferences',
  '/plans/weekend-in-sf/itinerary',
  '/plans/weekend-in-sf/collaboration',
]) {
  test(`accessible controls and no horizontal overflow: ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
  });
}
test('collect and review dialogs have accessible names, labels and contrast', async ({ page }) => {
  await page.goto('/places');
  await expect(page.locator('.place-card')).toHaveCount(5);
  await page.getByRole('button', { name: 'Collect a place', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Review A slow morning at Dayglow', exact: true }).click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});
