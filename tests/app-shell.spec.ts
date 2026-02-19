import { test, expect } from '@playwright/test';

test.describe('App Shell & Navigation', () => {
  // Note: These tests check unauthenticated behavior.
  // The middleware should redirect to login for protected routes.

  test('protected routes redirect to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('upload route redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/upload');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('settings routes redirect to login when unauthenticated', async ({ page }) => {
    await page.goto('/settings/profile');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('support route redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/support');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('public routes do not redirect', async ({ page }) => {
    // Landing page
    const homeRes = await page.goto('/');
    expect(homeRes?.status()).toBeLessThan(400);
    await expect(page).toHaveURL('/');

    // Pricing
    const pricingRes = await page.goto('/pricing');
    expect(pricingRes?.status()).toBeLessThan(400);

    // Blog
    const blogRes = await page.goto('/blog');
    expect(blogRes?.status()).toBeLessThan(400);
  });
});

test.describe('API Routes - Unauthenticated', () => {
  test('GET /api/vendors returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/vendors');
    expect(res.status()).toBe(401);
  });

  test('GET /api/compliance returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/compliance');
    expect(res.status()).toBe(401);
  });

  test('POST /api/upload returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/upload');
    expect(res.status()).toBe(401);
  });

  test('POST /api/extract returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/extract', {
      data: { document_id: 'fake' },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /api/reminders returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/reminders');
    expect(res.status()).toBe(401);
  });

  test('POST /api/export returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/export');
    expect(res.status()).toBe(401);
  });

  test('GET /api/team returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/team');
    expect(res.status()).toBe(401);
  });

  test('GET /api/billing/status returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/billing/status');
    expect(res.status()).toBe(401);
  });

  test('GET /api/support/tickets returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/support/tickets');
    expect(res.status()).toBe(401);
  });

  test('GET /api/user/profile returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/user/profile');
    expect(res.status()).toBe(401);
  });
});
