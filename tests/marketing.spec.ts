import { test, expect } from '@playwright/test';

test.describe('Marketing Pages', () => {
  test('homepage loads with all sections', async ({ page }) => {
    await page.goto('/');

    // Nav
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByText('COIStack').first()).toBeVisible();

    // Hero
    await expect(page.getByText('Stop chasing certificates.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Start Free Trial/i }).first()).toBeVisible();

    // How it works
    await expect(page.getByText('How it works')).toBeVisible();
    await expect(page.getByText('Upload COIs')).toBeVisible();

    // Features
    await expect(page.getByText('Everything you need for COI compliance')).toBeVisible();

    // FAQ
    await expect(page.getByText('Frequently asked questions')).toBeVisible();

    // CTA
    await expect(page.getByText('Ready to put your COI compliance on autopilot?')).toBeVisible();

    // Footer
    await expect(page.locator('footer')).toBeVisible();
  });

  test('pricing page loads with plan cards', async ({ page }) => {
    await page.goto('/pricing');

    await expect(page.getByText('Simple pricing that scales with you')).toBeVisible();

    // All 4 plan names visible (CardTitle renders as div, use data-slot selector)
    await expect(page.locator('[data-slot="card-title"]', { hasText: 'Starter' })).toBeVisible();
    await expect(page.locator('[data-slot="card-title"]', { hasText: 'Growth' })).toBeVisible();
    await expect(page.locator('[data-slot="card-title"]', { hasText: 'Pro' })).toBeVisible();
    await expect(page.locator('[data-slot="card-title"]', { hasText: 'Scale' })).toBeVisible();

    // Prices visible
    await expect(page.getByText('$149')).toBeVisible();
    await expect(page.getByText('$299')).toBeVisible();

    // Most Popular badge
    await expect(page.getByText('Most Popular')).toBeVisible();
  });

  test('blog listing page loads', async ({ page }) => {
    await page.goto('/blog');

    await expect(page.getByRole('heading', { name: 'Blog' })).toBeVisible();

    // Should have blog post cards (we created 10 posts)
    const postLinks = page.locator('a[href^="/blog/"]');
    const count = await postLinks.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('blog post page renders MDX content', async ({ page }) => {
    await page.goto('/blog/what-is-a-coi');

    // Should show article content
    await expect(page.locator('article')).toBeVisible();
    await expect(page.getByText('Back to Blog')).toBeVisible();

    // CTA section at bottom
    await expect(page.getByText('Ready to automate your COI compliance?')).toBeVisible();
  });

  test('FAQ accordion opens and closes', async ({ page }) => {
    await page.goto('/');

    const firstFaq = page.getByText('What is a Certificate of Insurance?');
    await firstFaq.click();

    // Answer should be visible
    await expect(page.getByText('issued by an insurance company')).toBeVisible();

    // Click again to close
    await firstFaq.click();
  });

  test('navigation links work', async ({ page }) => {
    await page.goto('/');

    // Click Pricing
    await page.getByRole('link', { name: 'Pricing' }).first().click();
    await expect(page).toHaveURL(/\/pricing/);

    // Click Blog
    await page.getByRole('link', { name: 'Blog' }).first().click();
    await expect(page).toHaveURL(/\/blog/);

    // Click logo to go home
    await page.getByText('COIStack').first().click();
    await expect(page).toHaveURL('/');
  });

  test('theme toggle switches between light and dark mode', async ({ page }) => {
    await page.goto('/');

    // Use visible toggle (desktop has one, mobile has another)
    const toggle = page.locator('button[aria-label="Toggle theme"]:visible');
    await toggle.click();

    // Should have dark class on html
    await expect(page.locator('html')).toHaveAttribute('class', /dark/);

    // Toggle back
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('class', /light/);
  });
});
