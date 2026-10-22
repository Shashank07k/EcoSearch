import { test, expect } from '@playwright/test';

const api = 'http://127.0.0.1:5010';

test.beforeEach(async ({ request }) => {
  await request.post(`${api}/__test/control`, { data: { reset: true } });
});

/**
 * Regression: a backend that accepts the connection but never responds used to
 * strand the catalog in its loading state forever (infinite skeleton cards +
 * "Finding thoughtful products…"). apiClient now enforces a bounded request
 * deadline and useProductSearch always settles, so the UI must reach a readable
 * error state with a working Retry.
 */
test('a hung product request cannot strand the catalog in an infinite skeleton state', async ({ page }) => {
  test.setTimeout(60_000);

  // Simulate a hung backend at the network layer: accept, never reply.
  await page.route('**/api/products?**', async () => { /* never fulfilled */ });

  await page.goto('/');
  // Skeletons appear first (loading state is legitimate while the request is in flight).
  await expect(page.locator('.product-skeleton').first()).toBeVisible();

  // It must settle into an error state with Retry — never stay loading forever.
  await expect(page.locator('.results-message--error')).toBeVisible({ timeout: 25_000 });
  await expect(page.locator('.results-message--error')).toContainText(/too long|try again/i);
  await expect(page.locator('.results-message--error button', { hasText: /Try again/i })).toBeVisible();
  await expect(page.locator('.product-skeleton')).toHaveCount(0);
  await expect(page.locator('.product-card')).toHaveCount(0);
});

test('Retry recovers the catalog once the backend responds again', async ({ page }) => {
  test.setTimeout(60_000);

  let hung = true;
  await page.route('**/api/products?**', async (route) => {
    if (hung) return; // never fulfil while "hung"
    await route.continue();
  });

  await page.goto('/');
  await expect(page.locator('.results-message--error')).toBeVisible({ timeout: 25_000 });

  hung = false;
  await page.locator('.results-message--error button', { hasText: /Try again/i }).click();
  await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.results-meta')).toContainText('of 28 products');
});

/**
 * Regression: the readability pass enlarged header/nav text, which overflowed
 * the authenticated header between 801px and 1100px (the tier that hides those
 * links starts at 800px). Verify no horizontal overflow while signed in.
 */
test('authenticated header does not overflow at 1024px', async ({ page }) => {
  await page.goto('/#/register');
  await page.locator('.auth-form').waitFor();
  await page.getByPlaceholder('Your name').fill('Width Check');
  await page.getByPlaceholder('you@example.com').fill(`width.${Date.now()}@example.com`);
  await page.getByPlaceholder('At least 8 characters').fill('StrongPassword123!');
  await page.locator('.auth-form').getByRole('button', { name: /Create account/ }).click();
  await expect(page.locator('.header-logout')).toBeVisible({ timeout: 15_000 });

  for (const width of [801, 900, 1024, 1100]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 15_000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow, `no horizontal overflow at ${width}px while authenticated`).toBe(false);
  }
});

/** Typography must stay readable (the point of the readability pass). */
test('core catalog typography meets readable minimums', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 15_000 });

  const sizes = await page.evaluate(() => {
    const px = (sel) => {
      const el = document.querySelector(sel);
      return el ? parseFloat(getComputedStyle(el).fontSize) : 0;
    };
    return {
      productName: px('.product-card__name'),
      productDesc: px('.product-card__summary'),
      price: px('.product-card__eyebrow strong'),
      analyzeBtn: px('.analyze-button'),
      categoryBtn: px('.category-filter'),
      searchInput: px('.search-bar input'),
      resultsMeta: px('.results-meta'),
      nav: px('.header-inner nav a'),
    };
  });

  expect(sizes.productName).toBeGreaterThanOrEqual(18);
  expect(sizes.productDesc).toBeGreaterThanOrEqual(15);
  expect(sizes.price).toBeGreaterThanOrEqual(18);
  expect(sizes.analyzeBtn).toBeGreaterThanOrEqual(15);
  expect(sizes.categoryBtn).toBeGreaterThanOrEqual(14);
  expect(sizes.searchInput).toBeGreaterThanOrEqual(15);
  expect(sizes.resultsMeta).toBeGreaterThanOrEqual(13);
  expect(sizes.nav).toBeGreaterThanOrEqual(14);
});
