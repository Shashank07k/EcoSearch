import { test, expect } from '@playwright/test';

const api = 'http://127.0.0.1:5010';

// Representative products across all six categories.
const REPRESENTATIVE = [
  'Stainless Steel Water Bottle', // Home
  'Bamboo Storage Box', // Home
  'Organic Cotton T-Shirt', // Clothing
  'Recycled Fabric Backpack', // Clothing
  'Bamboo Toothbrush', // Personal Care
  'Reusable Safety Razor', // Personal Care
  'Solar Power Bank', // Electronics
  'Energy Efficient Desk Lamp', // Electronics
  'Organic Green Tea', // Food
  'Glass Food Storage Container', // Food
  'City Bicycle', // Transportation
  'Electric Scooter', // Transportation
];

test.beforeEach(async ({ request }) => {
  await request.post(`${api}/__test/control`, { data: { reset: true } });
});

/** Waits until every visible product image has finished decoding. */
async function waitForCatalogImages(page) {
  await page.waitForFunction(
    () => {
      const imgs = [...document.querySelectorAll('.product-card img')];
      return imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth > 0);
    },
    null,
    { timeout: 25000 },
  );
  await page.waitForTimeout(150);
}

/** Collects every product across all catalog pages (name → image alt). */
async function collectCatalog(page) {
  await page.goto('/');
  await page.locator('.product-card').first().waitFor({ timeout: 15000 });

  const seen = new Map();
  let pages = 0;

  for (let i = 0; i < 8; i += 1) {
    pages += 1;
    await waitForCatalogImages(page);

    // No visible placeholder and no broken images on this page.
    expect(await page.locator('.product-card .product-image-placeholder:visible').count()).toBe(0);
    const broken = await page.evaluate(() =>
      [...document.querySelectorAll('.product-card img')]
        .filter((img) => !img.complete || img.naturalWidth === 0)
        .map((img) => img.alt),
    );
    expect(broken).toEqual([]);

    const names = await page.locator('.product-card__name').allTextContents();
    const alts = await page.evaluate(() =>
      [...document.querySelectorAll('.product-card img')].map((img) => img.alt),
    );
    names.forEach((name, index) => seen.set(name.trim(), alts[index]));

    const next = page.getByRole('button', { name: 'Next', exact: true });
    if (!(await next.count()) || (await next.isDisabled())) break;
    await next.click();
  }

  return { seen, pages };
}

test('all 28 products render a real image, never the leaf fallback', async ({ page }) => {
  const { seen, pages } = await collectCatalog(page);

  expect(seen.size, 'catalog size').toBe(28);
  expect(pages, 'catalog pages (9 per page)').toBe(4);

  // Every product's alt text must name that product.
  for (const [name, alt] of seen) {
    expect(alt, `alt text for ${name}`).toContain(name);
  }
  for (const name of REPRESENTATIVE) {
    expect(seen.has(name), `${name} should be in the catalog`).toBe(true);
  }
});

test('representative products from every category show their own loaded image', async ({ page }) => {
  await page.goto('/');
  await page.locator('.product-card').first().waitFor({ timeout: 15000 });

  for (const name of REPRESENTATIVE) {
    // Search is the most reliable way to bring a specific product into view.
    await page.getByRole('searchbox', { name: 'Search EcoSearch' }).fill(name.split(' ')[0]);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('.product-card') || document.querySelector('.results-message--empty'),
      null,
      { timeout: 10000 },
    );
    await waitForCatalogImages(page);

    const card = page.locator('.product-card', { hasText: name }).first();
    await expect(card, `${name} card`).toBeVisible();

    const img = card.locator('img');
    await expect(img, `${name} image element`).toHaveCount(1);
    await expect(img, `${name} alt text`).toHaveAttribute('alt', name);

    const loaded = await img.evaluate((el) => el.complete && el.naturalWidth > 0 && el.naturalHeight > 0);
    expect(loaded, `${name} image decoded`).toBe(true);

    // A working image means the placeholder must not be visible.
    expect(await card.locator('.product-image-placeholder').isVisible(), `${name} no fallback`).toBe(false);
  }
});

test('product details page shows the matching image', async ({ page }) => {
  await page.goto('/');
  await page.locator('.product-card').first().waitFor({ timeout: 15000 });

  for (const name of ['Stainless Steel Water Bottle', 'Solar Garden Light', 'Organic Green Tea']) {
    await page.goto('/');
    await page.locator('.product-card').first().waitFor({ timeout: 15000 });
    await page.getByRole('searchbox', { name: 'Search EcoSearch' }).fill(name.split(' ')[0]);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.locator('.product-card').first().waitFor();
    await waitForCatalogImages(page);

    await page.getByRole('link', { name: `View details for ${name}` }).first().click();
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible({ timeout: 10000 });

    const detailImg = page.locator('.detail-hero__media img');
    await expect(detailImg).toHaveCount(1);
    await expect(detailImg).toHaveAttribute('alt', `${name} product photo`);

    const ok = await detailImg.evaluate((el) => el.complete && el.naturalWidth > 0);
    expect(ok, `${name} details image loaded`).toBe(true);

    // Placeholder must not be visible on details either.
    await expect(page.locator('.detail-hero__media .product-image-placeholder')).toBeHidden();
  }
});

test('search still returns results with images for key terms', async ({ page }) => {
  for (const term of ['bottle', 'bamboo', 'organic', 'solar', 'reusable', 'cotton', 'electric', 'glass']) {
    await page.goto('/');
    await page.locator('.product-card').first().waitFor({ timeout: 15000 });
    await page.getByRole('searchbox', { name: 'Search EcoSearch' }).fill(term);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('.product-card') || document.querySelector('.results-message--empty'),
      null,
      { timeout: 10000 },
    );

    const count = await page.locator('.product-card').count();
    expect(count, `search "${term}" should return results`).toBeGreaterThan(0);

    await waitForCatalogImages(page);
    const imgOk = await page.evaluate(() =>
      [...document.querySelectorAll('.product-card img')].every((img) => img.complete && img.naturalWidth > 0),
    );
    expect(imgOk, `images loaded for "${term}"`).toBe(true);
  }
});

test('details page stays inside the viewport at mobile, tablet and desktop widths', async ({ page }) => {
  await page.goto('/');
  await page.locator('.product-card').first().waitFor({ timeout: 15000 });

  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.locator('.product-card').first().waitFor({ timeout: 15000 });
    await page.getByRole('link', { name: /View details for/ }).first().click();
    await page.locator('#product-detail-heading').waitFor({ timeout: 10000 });

    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(noOverflow, `no horizontal overflow at ${width}px`).toBe(true);

    const img = page.locator('.detail-hero__media img');
    if (await img.count()) {
      const inside = await img.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right <= window.innerWidth + 1;
      });
      expect(inside, `details image inside card at ${width}px`).toBe(true);
    }
  }
});
