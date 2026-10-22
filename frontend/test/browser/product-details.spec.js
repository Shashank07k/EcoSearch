import { test, expect } from '@playwright/test';

const api = 'http://127.0.0.1:5010';
const bottleName = 'Stainless Steel Water Bottle';
let sequence = 0;
const uniqueEmail = () => `details.${Date.now()}.${(sequence += 1)}@example.com`;

const search = async (page, query) => {
  await page.getByRole('searchbox', { name: 'Search EcoSearch' }).fill(query);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.product-card').first()).toBeVisible();
};

async function openBottleDetails(page) {
  await page.goto('/');
  await search(page, 'bottle');
  await page.getByRole('link', { name: `View details for ${bottleName}` }).click();
  await expect(page).toHaveURL(/#\/products\/[a-f0-9]+/);
  await expect(page.getByRole('heading', { name: bottleName, level: 1 })).toBeVisible();
}

async function registerViaUi(page) {
  await page.goto('/#/register');
  await page.locator('.auth-form').waitFor();
  await page.getByPlaceholder('Your name').fill('Details User');
  await page.getByPlaceholder('you@example.com').fill(uniqueEmail());
  await page.getByPlaceholder('At least 8 characters').fill('StrongPassword123!');
  await page.locator('.auth-form').getByRole('button', { name: /Create account/ }).click();
  await expect(page.locator('.header-logout')).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  await request.post(`${api}/__test/control`, { data: { reset: true } });
});

test('search → product → details shows product info, score and factors', async ({ page }) => {
  await openBottleDetails(page);

  // Product identity
  await expect(page.locator('.detail-hero__meta')).toContainText('EcoFlow');
  await expect(page.locator('.detail-hero__meta')).toContainText('₹799');
  await expect(page.locator('.detail-hero .eyebrow')).toHaveText('Home');
  await expect(page.locator('.detail-hero__description')).not.toBeEmpty();

  // Score + rating + disclaimer (catalog estimate before AI analysis)
  await expect(page.locator('.detail-score__value')).toContainText('85');
  await expect(page.locator('.detail-score__rating')).toContainText('Excellent');
  await expect(page.locator('.detail-disclaimer')).toContainText('not a scientific certification');

  // Positive reasons and trade-offs both rendered from stored factors
  await expect(page.getByRole('heading', { name: /Why this product may be a better choice/ })).toBeVisible();
  await expect(page.locator('.detail-reasons__column--positive')).toContainText('Durability');
  await expect(page.getByRole('heading', { name: /What to keep in mind/ })).toBeVisible();
  await expect(page.locator('.detail-reasons__column--tradeoff')).toContainText('Manufacturing energy');

  // Missing-information disclosure, never an invented claim
  await expect(page.locator('.detail-missing')).toContainText('Information not available');

  // Impact is conveyed by text, not colour alone
  await expect(page.locator('.detail-factor__badge').first()).toContainText(/Positive|Uncertain|Needs attention/);

  // Alternatives section always present
  await expect(page.getByRole('heading', { name: 'Other options to consider' })).toBeVisible();
});

test('anonymous users are prompted to sign in for analysis and favorites', async ({ page }) => {
  await openBottleDetails(page);
  await expect(page.getByRole('button', { name: 'Sign in to analyze' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in to save' }).click();
  await expect(page).toHaveURL(/#\/login/);
  await expect(page.locator('.auth-notice')).toContainText('save favorite');
});

test('authenticated analysis renders explanation, alternatives, favorite and compare', async ({ page }) => {
  await registerViaUi(page);
  await openBottleDetails(page);

  await page.getByRole('button', { name: 'Get AI sustainability analysis' }).click();
  await expect(page.locator('.detail-summary')).toContainText('estimate', { timeout: 10000 });
  await expect(page.locator('.analysis-source')).toContainText(/New analysis|Saved analysis/);

  // Validated AI factors and alternatives (from the mocked provider fixture)
  await expect(page.locator('.detail-reasons__column--positive')).toContainText('Reusability');
  await expect(page.locator('.detail-alternative-list')).toContainText('Glass reusable bottle');
  await expect(page.locator('.detail-alternative__hint').first()).toContainText('Suggested product type');

  // Favorite works from the details page (reuses existing favorites API)
  await page.getByRole('button', { name: 'Add to favorites' }).click();
  await expect(page.getByRole('button', { name: 'Remove from favorites' })).toBeVisible();

  // Compare works from the details page (reuses ComparisonContext)
  await page.getByRole('button', { name: 'Add to comparison' }).click();
  await expect(page.getByRole('button', { name: 'Remove from comparison' })).toBeVisible();
  await expect(page.locator('.header-badge')).toHaveText('1');
});

test('AI unavailable shows a clear message and never a fake analysis', async ({ page, request }) => {
  await registerViaUi(page);
  await request.post(`${api}/__test/control`, { data: { mode: 'unavailable' } });
  await openBottleDetails(page);
  await page.getByRole('button', { name: 'Get AI sustainability analysis' }).click();
  await expect(page.getByRole('alert')).toContainText('Sustainability analysis is temporarily unavailable.');
  await expect(page.locator('.analysis-source')).toHaveCount(0);
  // The deterministic/catalog information must still be readable.
  await expect(page.locator('.detail-score__value')).toContainText('85');
});

test('unknown product id shows a not-found state instead of an error crash', async ({ page }) => {
  await page.goto('/#/products/000000000000000000000000');
  await expect(page.getByRole('heading', { name: 'Product not found' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to products' }).click();
  await expect(page.locator('.product-card').first()).toBeVisible();
});

test('mobile 390px details layout has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await registerViaUi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openBottleDetails(page);
  await page.getByRole('button', { name: 'Get AI sustainability analysis' }).click();
  await expect(page.locator('.detail-alternative-list')).toBeVisible({ timeout: 10000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
