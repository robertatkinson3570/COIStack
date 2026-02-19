import { test, expect } from '@playwright/test';

test.describe('Settings Pages', () => {
  // -------------------------------------------------------------------------
  // Team
  // -------------------------------------------------------------------------

  test('team page redirects to login when unauthenticated', async ({
    page,
  }) => {
    await page.goto('/settings/team');
    await expect(page).toHaveURL(/\/auth\/login\?redirect=\/settings\/team/);
  });

  test('GET /api/team returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/team');
    expect(res.status()).toBe(401);
  });

  test('POST /api/team/invite returns 401 without auth', async ({
    request,
  }) => {
    const res = await request.post('/api/team/invite', {
      data: { email: 'test@example.com', role: 'member' },
    });
    expect(res.status()).toBe(401);
  });

  // -------------------------------------------------------------------------
  // Billing
  // -------------------------------------------------------------------------

  test('billing page redirects to login when unauthenticated', async ({
    page,
  }) => {
    await page.goto('/settings/billing');
    await expect(page).toHaveURL(
      /\/auth\/login\?redirect=\/settings\/billing/
    );
  });

  test('GET /api/billing/status returns 401 without auth', async ({
    request,
  }) => {
    const res = await request.get('/api/billing/status');
    expect(res.status()).toBe(401);
  });

  test('POST /api/billing/portal returns 401 without auth', async ({
    request,
  }) => {
    const res = await request.post('/api/billing/portal');
    expect(res.status()).toBe(401);
  });

  // -------------------------------------------------------------------------
  // Profile
  // -------------------------------------------------------------------------

  test('profile page redirects to login when unauthenticated', async ({
    page,
  }) => {
    await page.goto('/settings/profile');
    await expect(page).toHaveURL(
      /\/auth\/login\?redirect=\/settings\/profile/
    );
  });

  test('GET /api/user/profile returns 401 without auth', async ({
    request,
  }) => {
    const res = await request.get('/api/user/profile');
    expect(res.status()).toBe(401);
  });

  test('PUT /api/user/profile returns 401 without auth', async ({
    request,
  }) => {
    const res = await request.put('/api/user/profile', {
      data: { full_name: 'Test User' },
    });
    expect(res.status()).toBe(401);
  });

  // -------------------------------------------------------------------------
  // Integrations
  // -------------------------------------------------------------------------

  test('integrations page redirects to login when unauthenticated', async ({
    page,
  }) => {
    await page.goto('/settings/integrations');
    await expect(page).toHaveURL(
      /\/auth\/login\?redirect=\/settings\/integrations/
    );
  });

  test('GET /api/settings/integrations returns 401 without auth', async ({
    request,
  }) => {
    const res = await request.get('/api/settings/integrations');
    expect(res.status()).toBe(401);
  });
});
