import { test, expect } from '@playwright/test';
import { navigateAndVerify } from './helpers';

test.describe('Vendor Portal (Public)', () => {
  test('vendor portal page loads with layout for valid-looking token', async ({
    page,
  }) => {
    // Navigate to a vendor portal URL (with a fake token).
    // The page should NOT redirect to login — it is public.
    const res = await navigateAndVerify(
      page,
      '/vendor-portal/test-token-abc'
    );

    // Should not have been redirected to auth
    expect(page.url()).not.toContain('/auth/login');

    // The vendor portal layout should render
    await expect(page.getByText('COIStack').first()).toBeVisible();
    await expect(
      page.getByText('Vendor Self-Service Portal')
    ).toBeVisible();

    // Footer
    await expect(page.getByText('Powered by COIStack')).toBeVisible();
  });

  test('vendor portal shows error state for invalid token', async ({
    page,
  }) => {
    await page.goto('/vendor-portal/invalid-token-xyz');

    // Wait for loading to complete
    await page.waitForLoadState('networkidle');

    // Should show the error state (Portal Unavailable)
    await expect(page.getByText('Portal Unavailable')).toBeVisible();
  });

  test('vendor portal API is public (no 401)', async ({ request }) => {
    const res = await request.get('/api/vendor-portal/test-token');
    // May return 404 or 400 for invalid token, but NOT 401
    expect(res.status()).not.toBe(401);
  });
});
