import { test, expect } from '@playwright/test';

test.describe('Vendor Detail Page', () => {
  test('vendor routes redirect to login when unauthenticated', async ({
    page,
  }) => {
    await page.goto('/vendors/some-vendor-id');
    await expect(page).toHaveURL(/\/auth\/login/);

    const url = new URL(page.url());
    expect(url.searchParams.get('redirect')).toBe('/vendors/some-vendor-id');
  });

  test('GET /api/compliance returns 401 without auth', async ({
    request,
  }) => {
    const res = await request.get('/api/compliance');
    expect(res.status()).toBe(401);
  });

  test('GET /api/compliance/history returns 401 without auth', async ({
    request,
  }) => {
    const res = await request.get(
      '/api/compliance/history?vendor_id=some-id'
    );
    expect(res.status()).toBe(401);
  });
});
