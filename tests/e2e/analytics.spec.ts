import { test, expect } from '@playwright/test';

test.describe('Analytics Page', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page).toHaveURL(/\/auth\/login\?redirect=\/analytics/);
  });

  test('GET /api/analytics/portfolio returns 401 without auth', async ({
    request,
  }) => {
    const res = await request.get('/api/analytics/portfolio');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });
});
