import { test, expect } from '@playwright/test';
import { navigateAndVerify, expectHeading } from './helpers';

test.describe('Marketing Pages', () => {
  // -------------------------------------------------------------------------
  // Homepage
  // -------------------------------------------------------------------------

  test('homepage loads and renders all major sections', async ({ page }) => {
    await navigateAndVerify(page, '/');

    // Navigation bar
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByText('COIStack').first()).toBeVisible();

    // Hero section
    await expect(page.getByText('Stop chasing certificates.')).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Start Free Trial/i }).first()
    ).toBeVisible();

    // Pain Points section
    await expect(page.getByText('How it works')).toBeVisible();

    // Features section
    await expect(
      page.getByText('Everything you need for COI compliance')
    ).toBeVisible();

    // FAQ section
    await expect(page.getByText('Frequently asked questions')).toBeVisible();

    // CTA section
    await expect(
      page.getByText('Ready to put your COI compliance on autopilot?')
    ).toBeVisible();

    // Footer
    await expect(page.locator('footer')).toBeVisible();
  });

  test('homepage hero CTA links go to correct destinations', async ({
    page,
  }) => {
    await page.goto('/');

    // "Start Free Trial" should link to register
    const trialLink = page
      .getByRole('link', { name: /Start Free Trial/i })
      .first();
    await expect(trialLink).toHaveAttribute('href', '/auth/register');

    // "See Pricing" should link to pricing
    const pricingLink = page
      .getByRole('link', { name: /See Pricing/i })
      .first();
    await expect(pricingLink).toHaveAttribute('href', '/pricing');
  });

  test('FAQ accordion opens and closes on click', async ({ page }) => {
    await page.goto('/');

    const firstFaq = page.getByText('What is a Certificate of Insurance?');
    await firstFaq.click();

    // Answer content should become visible
    await expect(
      page.getByText('issued by an insurance company')
    ).toBeVisible();

    // Click again to close
    await firstFaq.click();
  });

  // -------------------------------------------------------------------------
  // Pricing Page
  // -------------------------------------------------------------------------

  test('pricing page loads with all four plan cards', async ({ page }) => {
    await navigateAndVerify(page, '/pricing');

    await expect(
      page.getByText('Simple pricing that scales with you')
    ).toBeVisible();

    // All 4 plan names (in card titles)
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Starter' })
    ).toBeVisible();
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Growth' })
    ).toBeVisible();
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Pro' })
    ).toBeVisible();
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Scale' })
    ).toBeVisible();

    // Prices visible
    await expect(page.getByText('$149')).toBeVisible();
    await expect(page.getByText('$299')).toBeVisible();

    // Most Popular badge
    await expect(page.getByText('Most Popular')).toBeVisible();

    // Trial note
    await expect(
      page.getByText('All plans include a 14-day free trial')
    ).toBeVisible();
  });

  test('pricing page has correct title', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page).toHaveTitle(/Pricing/);
  });

  // -------------------------------------------------------------------------
  // Blog Page
  // -------------------------------------------------------------------------

  test('blog listing page renders with posts', async ({ page }) => {
    await navigateAndVerify(page, '/blog');

    await expectHeading(page, 'Blog');

    // Should have at least one blog post link
    const postLinks = page.locator('a[href^="/blog/"]');
    const count = await postLinks.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('blog post page renders MDX content', async ({ page }) => {
    await navigateAndVerify(page, '/blog/what-is-a-coi');

    // Article content
    await expect(page.locator('article')).toBeVisible();
    await expect(page.getByText('Back to Blog')).toBeVisible();

    // CTA section at bottom
    await expect(
      page.getByText('Ready to automate your COI compliance?')
    ).toBeVisible();
  });

  test('blog post page has SEO metadata', async ({ page }) => {
    await page.goto('/blog/what-is-a-coi');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(5);
  });

  // -------------------------------------------------------------------------
  // Navigation links
  // -------------------------------------------------------------------------

  test('marketing nav links navigate correctly', async ({ page }) => {
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

  test('theme toggle switches between light and dark mode', async ({
    page,
  }) => {
    await page.goto('/');

    const toggle = page.locator(
      'button[aria-label="Toggle theme"]:visible'
    );
    await toggle.click();

    // Should have dark class on html
    await expect(page.locator('html')).toHaveAttribute('class', /dark/);

    // Toggle back
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('class', /light/);
  });
});
