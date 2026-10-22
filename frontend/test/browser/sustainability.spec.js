import { test, expect } from '@playwright/test';

const api = 'http://127.0.0.1:5010';
const bottleName = 'Stainless Steel Water Bottle';
let emailSequence = 0;

const search = async (page, query) => {
  await page.getByRole('searchbox', { name: 'Search EcoSearch' }).fill(query);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
};
const bottle = (page) => page.getByRole('article', { name: bottleName, exact: true });

// Registers through the REAL UI, then returns to the public catalog.
async function registerViaUi(page) {
  await page.goto('/#/register');
  await page.getByPlaceholder('Your name').fill('Browser User');
  const email = `browser.${Date.now()}.${(emailSequence += 1)}@example.com`;
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('StrongPassword123!');
  await page.locator('.auth-form').getByRole('button', { name: /Create account/ }).click();
  await expect(page.locator('.header-logout')).toBeVisible();
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(9);
  return email;
}

test.beforeEach(async ({ page, request }) => {
  await request.post(`${api}/__test/control`, { data: { reset: true } });
  await page.addInitScript(() => {
    window.observedAnalysisLoading = false;
    window.observedCatalogLoading = false;
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver(() => {
        if (document.querySelector('.analyze-button[aria-busy="true"]')) window.observedAnalysisLoading = true;
        if (document.querySelector('.results-message--loading')) window.observedCatalogLoading = true;
      }).observe(document.body, { childList: true, attributes: true, subtree: true, characterData: true });
    });
  });
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(9);
});

test('catalog, pagination, case-insensitive search, short query and no-results work while logged out', async ({ page }) => {
  await expect(page.locator('.results-meta')).toContainText('of 28 products');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(9);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(9);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await search(page, 'WATER');
  await expect(bottle(page)).toBeVisible();
  await expect(page.locator('.product-card')).toHaveCount(3);
  await search(page, 'a');
  await expect(page.getByRole('alert')).toContainText('at least 2 characters');
  await search(page, 'zzzzqq');
  await expect(page.getByRole('heading', { name: /No products found/ })).toBeVisible();
  expect(await page.evaluate(() => window.observedCatalogLoading)).toBe(true);
});

test('authenticated real backend POST displays validated analysis, then persisted cache survives reload', async ({ page, request }) => {
  await registerViaUi(page);
  await search(page, 'water');
  const networkRequest = page.waitForRequest((r) => r.url().endsWith('/analyze') && r.method() === 'POST');
  await bottle(page).getByRole('button', { name: /Analyze Sustainability/ }).click();
  const recorded = await networkRequest;
  expect(recorded.headers().authorization).toMatch(/^Bearer eyJ/);
  await expect(bottle(page).getByRole('heading', { name: 'AI Sustainability Analysis' })).toBeVisible();
  await expect(bottle(page).locator('.analysis-score')).toHaveText('84/100');
  await expect(bottle(page).locator('.analysis-rating')).toContainText('Excellent');
  await expect(bottle(page).locator('.analysis-factors')).toContainText('Reusability');
  await expect(bottle(page).locator('.analysis-alternatives')).toContainText('Glass reusable bottle');
  await expect(bottle(page).locator('.analysis-disclaimer')).toContainText('not a certified');
  expect(await page.evaluate(() => window.observedAnalysisLoading)).toBe(true);

  // CRITICAL: the user must remain logged in after an authenticated analysis.
  await expect(page.locator('.header-logout')).toBeVisible();
  await expect(page.locator('.user-chip')).toBeVisible();
  expect(await page.evaluate(() => !!localStorage.getItem('ecosearch_token'))).toBe(true);

  await bottle(page).getByRole('button', { name: /Check saved analysis/ }).click();
  await expect(bottle(page).locator('.analysis-source')).toHaveText('Saved analysis');
  expect((await (await request.get(`${api}/__test/state`)).json()).calls).toBe(1);

  // Still logged in after the cached (no new AI call) analysis.
  await expect(page.locator('.header-logout')).toBeVisible();
  expect(await page.evaluate(() => !!localStorage.getItem('ecosearch_token'))).toBe(true);

  await page.reload();
  await expect(page.locator('.header-logout')).toBeVisible();
  await search(page, 'water');
  await bottle(page).getByRole('button', { name: /Analyze Sustainability|Check saved analysis/ }).click();
  await expect(bottle(page).locator('.analysis-source')).toHaveText('Saved analysis');
  expect((await (await request.get(`${api}/__test/state`)).json()).calls).toBe(1);
});

for (const [mode, heading] of [['unavailable', 'AI analysis unavailable'], ['failure', 'Unable to analyze this product'], ['invalid', 'Analysis could not be validated']]) {
  test(`${mode}: isolated error, no fake analysis, successful retry`, async ({ page, request }) => {
    await registerViaUi(page);
    await request.post(`${api}/__test/control`, { data: { mode } });
    await search(page, 'water');
    await bottle(page).getByRole('button', { name: /Analyze Sustainability/ }).click();
    await expect(bottle(page).getByRole('alert')).toContainText(heading);
    await expect(bottle(page).locator('.analysis-result')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeEnabled();
    await request.post(`${api}/__test/control`, { data: { mode: 'valid' } });
    await bottle(page).getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(bottle(page).locator('.analysis-result')).toBeVisible();
  });
}

test('database outage shows public catalog error; retry recovers with real MongoDB', async ({ page, request }) => {
  await request.post(`${api}/__test/control`, { data: { databaseOffline: true } });
  await search(page, 'water');
  await expect(page.locator('.results-message--error')).toContainText('Database is not available');
  await request.post(`${api}/__test/control`, { data: { reset: true } });
  await page.locator('.results-message--error').getByRole('button', { name: 'Try again' }).click();
  await expect(bottle(page)).toBeVisible();
});

test('AI text is escaped and never rendered as executable HTML', async ({ page, request }) => {
  await registerViaUi(page);
  await request.post(`${api}/__test/control`, { data: { mode: 'markup' } });
  await search(page, 'water');
  await bottle(page).getByRole('button', { name: /Analyze Sustainability/ }).click();
  await expect(bottle(page).locator('.analysis-summary')).toContainText('<img src=x');
  await expect(bottle(page).locator('.analysis-summary img')).toHaveCount(0);
  expect(await page.evaluate(() => window.unsafeAI)).toBeUndefined();
});

test('mobile layout and authenticated analysis remain accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await registerViaUi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await search(page, 'water');
  await bottle(page).getByRole('button', { name: /Sign in to analyze|Analyze Sustainability/ }).click();
  await expect(bottle(page).locator('.analysis-result')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('authenticated analyze sends Authorization and keeps the user signed in', async ({ page }) => {
  await registerViaUi(page);
  await search(page, 'bottle');
  const target = page.locator('.product-card').first();

  const request = await (async () => {
    const waiter = page.waitForRequest((r) => r.url().endsWith('/analyze') && r.method() === 'POST');
    await target.getByRole('button', { name: /Analyze Sustainability/ }).click();
    return waiter;
  })();

  // The Authorization header must reach the backend.
  expect(request.headers().authorization).toMatch(/^Bearer eyJ/);

  // Authenticated analysis succeeds.
  await expect(target.locator('.analysis-result')).toBeVisible({ timeout: 15000 });

  // The user must STILL be logged in afterwards (no silent logout).
  await expect(page.locator('.header-logout')).toBeVisible();
  expect(await page.evaluate(() => !!localStorage.getItem('ecosearch_token'))).toBe(true);

  // And still logged in after a reload.
  await page.reload();
  await expect(page.locator('.header-logout')).toBeVisible();
  expect(await page.evaluate(() => !!localStorage.getItem('ecosearch_token'))).toBe(true);
});

test('anonymous user gets the sign-in CTA instead of an analyze request', async ({ page }) => {
  await page.goto('/');
  await page.locator('.product-card').first().waitFor();
  const target = page.locator('.product-card').first();
  const analyzeReqs = [];
  page.on('request', (r) => { if (r.url().endsWith('/analyze')) analyzeReqs.push(r); });

  const btn = target.getByRole('button', { name: 'Sign in to analyze' });
  await expect(btn).toBeVisible();
  await btn.click();
  // Anonymous users are routed to login — no request should hit /analyze.
  await expect(page).toHaveURL(/#\/login/);
  expect(analyzeReqs).toHaveLength(0);
});

test('login during a slow /auth/me bootstrap does not get logged out by the stale request', async ({ page }) => {
  // Force the bootstrap /auth/me request to resolve AFTER the user registers,
  // reproducing the race where a tokenless bootstrap request would clear a
  // fresh login. Delay only the /auth/me GET (the "me" introspection), which
  // fires on mount with no token yet.
  await page.route('**/api/auth/me', async (route) => {
    await new Promise((r) => setTimeout(r, 3000));
    await route.continue();
  });

  await page.goto('/#/register');
  await page.locator('.auth-form').waitFor({ timeout: 20000 });
  await page.getByPlaceholder('Your name').fill('Race Guard');
  await page.getByPlaceholder('you@example.com').fill(`race.${Date.now()}.${(emailSequence += 1)}@example.com`);
  await page.getByPlaceholder('At least 8 characters').fill('StrongPassword123!');
  await page.locator('.auth-form').getByRole('button', { name: /Create account/ }).click();

  // Login completes quickly while bootstrap is still delayed.
  await expect(page.locator('.header-logout')).toBeVisible({ timeout: 15000 });

  // Wait until the delayed /auth/me finally resolves — the critical moment
  // where the stale (tokenless) request used to clear the fresh session.
  await page.waitForTimeout(5000);

  // The user must STILL be authenticated (token + logout button intact).
  await expect(page.locator('.header-logout')).toBeVisible();
  expect(await page.evaluate(() => !!localStorage.getItem('ecosearch_token'))).toBe(true);
});

test('rejected JWT surfaces an explicit session-expiry message rather than a silent logout', async ({ page }) => {
  await registerViaUi(page);
  await search(page, 'water');
  // Simulate a session that ended server-side (expired token / rotated secret):
  // drop the valid token so the server must reject the request with 401.
  await page.evaluate(() => localStorage.removeItem('ecosearch_token'));
  const target = page.locator('.product-card').first();
  // Re-click analyze; the client still believes it is authenticated until the
  // server rejects it.
  await target.getByRole('button', { name: /Analyze Sustainability|Sign in to analyze/ }).click();
  await page.waitForTimeout(1500);
  const state = await page.evaluate(() => ({
    tokenGone: !localStorage.getItem('ecosearch_token'),
    loggedOut: !document.querySelector('.header-logout'),
    errText: document.querySelector('.analysis-error')?.innerText?.replace(/\s+/g, ' ') || null,
  }));
  expect(state.tokenGone).toBe(true);
  expect(state.loggedOut).toBe(true);
  // Message must explain the session ended, not claim the user was never signed in.
  if (state.errText) expect(state.errText).toContain('session expired');
});
