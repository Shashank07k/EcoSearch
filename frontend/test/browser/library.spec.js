import { test, expect } from '@playwright/test';

const api = 'http://127.0.0.1:5010';
const bottleName = 'Stainless Steel Water Bottle';
let sequence = 0;
const uniqueEmail = () => `lib.${Date.now()}.${(sequence += 1)}@example.com`;

const search = async (page, query) => {
  await page.getByRole('searchbox', { name: 'Search EcoSearch' }).fill(query);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
};
const bottle = (page) => page.getByRole('article', { name: bottleName, exact: true });

async function register(page, email = uniqueEmail()) {
  await page.goto('/#/register');
  await page.getByPlaceholder('Your name').fill('Library User');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('StrongPassword123!');
  await page.locator('.auth-form').getByRole('button', { name: /Create account/ }).click();
  await expect(page.locator('.header-logout')).toBeVisible();
  return email;
}

test.beforeEach(async ({ request }) => {
  await request.post(`${api}/__test/control`, { data: { reset: true } });
});

test('anonymous search works and favorite/history require login', async ({ page }) => {
  await page.goto('/');
  await search(page, 'water');
  await expect(bottle(page)).toBeVisible();
  await bottle(page).getByRole('button', { name: 'Sign in to save' }).click();
  await expect(page).toHaveURL(/#\/login/);
  await expect(page.locator('.auth-notice')).toContainText('save favorite');
  await page.goto('/#/history');
  await expect(page).toHaveURL(/#\/login/);
});

test('favorite persists across refresh and can be removed from the Favorites page', async ({ page }) => {
  await register(page);
  await page.goto('/');
  await search(page, 'water');
  await bottle(page).getByRole('button', { name: 'Add to Favorites' }).click();
  await expect(bottle(page).getByRole('button', { name: 'Remove from favorites' })).toBeVisible();
  await page.reload();
  await search(page, 'water');
  await expect(bottle(page).getByRole('button', { name: 'Remove from favorites' })).toBeVisible();
  await page.getByRole('button', { name: 'Favorites', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My favorite products' })).toBeVisible();
  await expect(page.getByRole('article', { name: bottleName })).toBeVisible();
  await page.getByRole('article', { name: bottleName }).getByRole('button', { name: 'Remove from favorites' }).click();
  await expect(page.getByRole('heading', { name: /haven't saved any products/i })).toBeVisible();
});

test('authenticated search appears in history, search-again works, and delete removes it', async ({ page }) => {
  await register(page);
  await page.goto('/');
  await search(page, 'water');
  await expect(bottle(page)).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Search history' })).toBeVisible();
  await expect(page.locator('.history-item strong').filter({ hasText: /^water$/i })).toBeVisible();
  await page.getByRole('button', { name: 'Search again' }).first().click();
  await expect(page.getByRole('searchbox', { name: 'Search EcoSearch' })).toHaveValue(/water/i);
  await expect(bottle(page)).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: 'Delete' }).first().click();
  await expect(page.getByRole('heading', { name: 'No searches yet' })).toBeVisible();
});

test('user B cannot see user A favorites or history', async ({ page }) => {
  const emailA = uniqueEmail();
  await register(page, emailA);
  await page.goto('/');
  await search(page, 'water');
  await bottle(page).getByRole('button', { name: 'Add to Favorites' }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).first().click();

  await register(page);
  await page.goto('/#/favorites');
  await expect(page.getByRole('heading', { name: /haven't saved any products/i })).toBeVisible();
  await page.goto('/#/history');
  await expect(page.getByRole('heading', { name: 'No searches yet' })).toBeVisible();
});
