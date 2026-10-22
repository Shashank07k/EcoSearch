import { test, expect } from '@playwright/test';

const api = 'http://127.0.0.1:5010';
const bottleName = 'Stainless Steel Water Bottle';
let sequence = 0;
const uniqueEmail = () => `auth.${Date.now()}.${(sequence += 1)}@example.com`;

const search = async (page, query) => {
  await page.getByRole('searchbox', { name: 'Search EcoSearch' }).fill(query);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
};
const bottle = (page) => page.getByRole('article', { name: bottleName, exact: true });

test.beforeEach(async ({ request }) => {
  await request.post(`${api}/__test/control`, { data: { reset: true } });
});

test('unauthenticated analyze routes to login; registering returns home and enables analysis', async ({ page }) => {
  await page.goto('/');
  await search(page, 'water');
  const analyzeRequests = [];
  page.on('request', (request) => { if (request.url().endsWith('/analyze')) analyzeRequests.push(request); });
  await bottle(page).getByRole('button', { name: /Sign in to analyze/ }).click();
  await expect(page).toHaveURL(/#\/login/);
  await expect(page.locator('.auth-notice')).toContainText('sign in or create an account');
  expect(analyzeRequests).toHaveLength(0);

  // Register from the intercepted action; auto-login redirects back to '#/'.
  await page.locator('.auth-form').getByRole('button', { name: 'Create an account' }).click();
  await page.getByPlaceholder('Your name').fill('Shashank');
  await page.getByPlaceholder('you@example.com').fill(uniqueEmail());
  await page.getByPlaceholder('At least 8 characters').fill('StrongPassword123!');
  await page.locator('.auth-form').getByRole('button', { name: /Create account/ }).click();

  await expect(page).toHaveURL(/^http:\/\/[^/]+\/#\/?$/);
  await expect(page.locator('.header-logout')).toBeVisible();
  await search(page, 'water');
  await bottle(page).getByRole('button', { name: /Analyze Sustainability/ }).click();
  await expect(bottle(page).locator('.analysis-result')).toBeVisible();
});

test('dashboard is protected; logout removes the token and invalid credentials show a generic error', async ({ page }) => {
  const email = uniqueEmail();

  // Direct protected route while logged out redirects to login.
  await page.goto('/#/dashboard');
  await expect(page).toHaveURL(/#\/login/);

  // Wrong credentials: same generic message as an unknown account.
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('WrongPassword99!');
  await page.locator('.auth-form').getByRole('button', { name: /Sign in/ }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid email or password');

  // Register instead → automatic login and dashboard access.
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByPlaceholder('Your name').fill('Shashank');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('StrongPassword123!');
  await page.locator('.auth-form').getByRole('button', { name: /Create account/ }).click();
  await page.goto('/#/dashboard');
  await expect(page.getByRole('heading', { name: /Hello, Shashank/ })).toBeVisible();
  await expect(page.locator('.role-badge--user')).toContainText('user');
  expect(await page.evaluate(() => Boolean(localStorage.getItem('ecosearch_token')))).toBe(true);

  await page.getByRole('button', { name: 'Logout', exact: true }).first().click();
  await expect(page.locator('.header-logout')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('ecosearch_token'))).toBeNull();
  await page.goto('/#/dashboard');
  await expect(page).toHaveURL(/#\/login/);
});

test('login works for the seeded admin and role enforcement is enforced with real JWTs', async ({ page }) => {
  const userEmail = uniqueEmail();

  // Register a normal user through the UI and capture its token from localStorage.
  await page.goto('/#/register');
  await expect(page.locator('.auth-form')).toBeVisible();
  await page.getByPlaceholder('Your name').fill('Normal User');
  await page.getByPlaceholder('you@example.com').fill(userEmail);
  await page.getByPlaceholder('At least 8 characters').fill('StrongPassword123!');
  await page.locator('.auth-form').getByRole('button', { name: /Create account/ }).click();
  await expect(page.locator('.header-logout')).toBeVisible();
  const userToken = await page.evaluate(() => localStorage.getItem('ecosearch_token'));

  // Normal user cannot create products (403) via the same Authorization header the UI sends.
  const userResponse = await page.evaluate(async ({ apiUrl, token }) => {
    const response = await fetch(`${apiUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Should be forbidden', category: 'Home' }),
    });
    return response.status;
  }, { apiUrl: `${api}/api`, token: userToken });
  expect(userResponse).toBe(403);

  // Log out, then sign in as the fixture admin.
  await page.getByRole('button', { name: 'Logout', exact: true }).first().click();
  await page.goto('/#/login');
  await page.getByPlaceholder('you@example.com').fill('admin@ecosearch.test');
  await page.getByPlaceholder('At least 8 characters').fill('AdminPassword123!');
  await page.locator('.auth-form').getByRole('button', { name: /Sign in/ }).click();
  await expect(page.locator('.user-meta small')).toContainText('Administrator');
  const adminToken = await page.evaluate(() => localStorage.getItem('ecosearch_token'));

  // Admin can create; public POST is 401.
  const statuses = await page.evaluate(async ({ apiUrl, token }) => {
    const headers = { 'Content-Type': 'application/json' };
    const publicPost = await fetch(`${apiUrl}/products`, {
      method: 'POST', headers, body: JSON.stringify({ name: 'Anonymous Product', category: 'Home' }),
    });
    const adminPost = await fetch(`${apiUrl}/products`, {
      method: 'POST',
      headers: { ...headers, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Admin Created Product', category: 'Home', price: 3 }),
    });
    return { public: publicPost.status, admin: adminPost.status };
  }, { apiUrl: `${api}/api`, token: adminToken });
  expect(statuses.public).toBe(401);
  expect(statuses.admin).toBe(201);
});

test('registration ignores client-supplied admin role', async ({ page }) => {
  await page.goto('/');
  const email = uniqueEmail();
  const response = await page.evaluate(async ({ apiUrl, payload }) => {
    const result = await fetch(`${apiUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { status: result.status, body: await result.json() };
  }, {
    apiUrl: `${api}/api`,
    payload: {
      name: 'Role Escalation',
      email,
      password: 'StrongPassword123!',
      role: 'admin',
      isAdmin: true,
    },
  });
  expect(response.status).toBe(201);
  expect(response.body.data.user.role).toBe('user');
  expect(response.body.data.user.passwordHash).toBeUndefined();
});
