import { test, expect } from '@playwright/test';

test.describe('Support Page', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/support');
    await expect(page).toHaveURL(/\/auth\/login\?redirect=\/support/);
  });

  test('GET /api/support/tickets returns 401 without auth', async ({
    request,
  }) => {
    const res = await request.get('/api/support/tickets');
    expect(res.status()).toBe(401);
  });

  test('POST /api/support/tickets returns 401 without auth', async ({
    request,
  }) => {
    const res = await request.post('/api/support/tickets', {
      data: { subject: 'Test', description: 'Help needed' },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/support/ai/sessions returns 401 without auth', async ({
    request,
  }) => {
    const res = await request.get('/api/support/ai/sessions');
    expect(res.status()).toBe(401);
  });

  test('POST /api/support/ai/chat returns 401 without auth', async ({
    request,
  }) => {
    const res = await request.post('/api/support/ai/chat', {
      data: { session_id: 'fake', message: 'hello' },
    });
    expect(res.status()).toBe(401);
  });
});
