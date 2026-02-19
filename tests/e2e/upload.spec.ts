import { test, expect } from '@playwright/test';

test.describe('Upload Page', () => {
  test('redirects unauthenticated users to login with redirect param', async ({
    page,
  }) => {
    await page.goto('/upload');
    await expect(page).toHaveURL(/\/auth\/login\?redirect=\/upload/);
  });

  test('POST /api/upload returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/upload');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('POST /api/extract returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/extract', {
      data: { document_id: 'fake-id' },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('Bulk Upload Page', () => {
  test('redirects unauthenticated users to login with redirect param', async ({
    page,
  }) => {
    await page.goto('/upload/bulk');
    await expect(page).toHaveURL(/\/auth\/login\?redirect=\/upload\/bulk/);
  });

  test('POST /api/upload/bulk returns 401 without auth', async ({
    request,
  }) => {
    const res = await request.post('/api/upload/bulk');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });
});
