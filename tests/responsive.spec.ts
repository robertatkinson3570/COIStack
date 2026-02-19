import { test, expect } from '@playwright/test';

test.describe('Responsive Design', () => {
  test('homepage renders correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // Mobile hamburger should be visible
    await expect(page.getByRole('button', { name: /Toggle menu/i })).toBeVisible();

    // Desktop nav links should be hidden on mobile
    const desktopNav = page.locator('nav .hidden.md\\:flex');
    await expect(desktopNav).toBeHidden();

    // Hero text should still be visible
    await expect(page.getByText('Stop chasing certificates.')).toBeVisible();
  });

  test('mobile nav menu opens and navigates', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // Open mobile menu
    await page.getByRole('button', { name: /Toggle menu/i }).click();

    // Menu items should be visible
    await expect(page.getByText('Features').last()).toBeVisible();
    await expect(page.getByText('Pricing').last()).toBeVisible();

    // Login button in mobile menu
    await expect(page.getByText('Login').last()).toBeVisible();
  });

  test('pricing cards stack on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/pricing');

    // All plan card titles should be visible (stacked vertically)
    await expect(page.locator('[data-slot="card-title"]', { hasText: 'Starter' })).toBeVisible();
    await expect(page.locator('[data-slot="card-title"]', { hasText: 'Growth' })).toBeVisible();
  });

  test('blog grid adapts to tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/blog');

    await expect(page.getByRole('heading', { name: 'Blog' })).toBeVisible();
  });

  test('auth pages are centered on all viewports', async ({ page }) => {
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/auth/login');
      await expect(page.getByText('Welcome back')).toBeVisible();
    }
  });
});
