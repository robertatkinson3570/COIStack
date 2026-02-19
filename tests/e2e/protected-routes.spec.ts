import { test, expect } from '@playwright/test';

/**
 * These tests verify that protected routes redirect unauthenticated users
 * to the login page, and that public routes remain accessible.
 */
test.describe('Protected Route Redirects', () => {
  const protectedRoutes = [
    '/dashboard',
    '/upload',
    '/upload/bulk',
    '/analytics',
    '/support',
    '/settings/profile',
    '/settings/team',
    '/settings/billing',
    '/settings/integrations',
    '/vendors',
  ];

  for (const route of protectedRoutes) {
    test(`${route} redirects to login when unauthenticated`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/auth\/login/);

      // Should include redirect query param so user goes back after login
      const url = new URL(page.url());
      expect(url.searchParams.get('redirect')).toBe(route);
    });
  }

  const publicRoutes = ['/', '/pricing', '/blog', '/coi-grader'];

  for (const route of publicRoutes) {
    test(`${route} does NOT redirect (public)`, async ({ page }) => {
      const res = await page.goto(route);
      expect(res?.status()).toBeLessThan(400);

      // Should NOT have been redirected to login
      expect(page.url()).not.toContain('/auth/login');
    });
  }
});

test.describe('API Route Auth Guards', () => {
  const protectedApiRoutes = [
    { method: 'GET' as const, path: '/api/vendors' },
    { method: 'GET' as const, path: '/api/compliance' },
    { method: 'POST' as const, path: '/api/upload' },
    { method: 'POST' as const, path: '/api/extract' },
    { method: 'POST' as const, path: '/api/reminders' },
    { method: 'POST' as const, path: '/api/export' },
    { method: 'GET' as const, path: '/api/team' },
    { method: 'GET' as const, path: '/api/billing/status' },
    { method: 'GET' as const, path: '/api/support/tickets' },
    { method: 'GET' as const, path: '/api/user/profile' },
    { method: 'GET' as const, path: '/api/analytics/portfolio' },
    { method: 'GET' as const, path: '/api/settings/integrations' },
  ];

  for (const { method, path } of protectedApiRoutes) {
    test(`${method} ${path} returns 401 without auth`, async ({
      request,
    }) => {
      let res;
      if (method === 'GET') {
        res = await request.get(path);
      } else {
        res = await request.post(path);
      }
      expect(res.status()).toBe(401);

      // Should return JSON (not an HTML redirect)
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    });
  }

  test('public API routes are accessible without auth', async ({
    request,
  }) => {
    // COI grader upload endpoint should not return 401
    // (it may return 400 for missing body, but not 401)
    const res = await request.post('/api/coi-grader/uploads');
    expect(res.status()).not.toBe(401);
  });
});
