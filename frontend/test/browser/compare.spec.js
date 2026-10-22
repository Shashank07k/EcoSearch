import { test, expect } from '@playwright/test';

const api = 'http://127.0.0.1:5010';
const bottleName = 'Stainless Steel Water Bottle';

test.beforeEach(async ({ request }) => {
  await request.post(`${api}/__test/control`, { data: { reset: true } });
});

test('anonymous comparison and recommendation work end-to-end', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Search EcoSearch' }).fill('bottle');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const cards = page.locator('.product-card');
  await expect(cards.first()).toBeVisible();
  await cards.nth(0).locator('.compare-button').click();
  await cards.nth(1).locator('.compare-button').click();
  await expect(page.locator('.compare-bar')).toContainText('Selected: 2/4');
  await page.getByRole('button', { name: 'Compare Selected' }).click();
  await expect(page).toHaveURL(/#\/compare/);
  await expect(page.locator('.recommendation-card')).toBeVisible();
  await expect(page.locator('.comparison-grid')).toBeVisible();
});

test('maximum of 4 products is enforced and the 5th Compare button is disabled', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('.product-card');
  await expect(cards.first()).toBeVisible();
  for (let i = 0; i < 4; i += 1) {
    await cards.nth(i).locator('.compare-button').click();
  }
  await expect(page.locator('.compare-bar')).toContainText('Selected: 4/4');
  const fifth = cards.nth(4).locator('.compare-button');
  await expect(fifth).toBeDisabled();
});

test('compare page shows an empty state when fewer than 2 products are selected', async ({ page }) => {
  await page.goto('/#/compare');
  await expect(page.getByRole('heading', { name: /Select at least 2 products/i })).toBeVisible();
});

test('AI-unavailable still shows deterministic recommendation', async ({ page, request }) => {
  await request.post(`${api}/__test/control`, { data: { mode: 'unavailable' } });
  await page.goto('/');
  const cards = page.locator('.product-card');
  await expect(cards.first()).toBeVisible();
  await cards.nth(0).locator('.compare-button').click();
  await cards.nth(1).locator('.compare-button').click();
  await page.getByRole('button', { name: 'Compare Selected' }).click();
  await expect(page.locator('.recommendation-card')).toBeVisible();
  await expect(page.locator('.recommendation-ai')).toHaveCount(0);
});
