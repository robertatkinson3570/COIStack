import { test, expect } from '@playwright/test';

test.describe('SEO & Meta', () => {
  test('homepage has correct title and meta', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/COIStack/);
  });

  test('pricing page has correct title', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page).toHaveTitle(/Pricing/);
  });

  test('login page has correct title', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page).toHaveTitle(/Sign In/);
  });

  test('register page has correct title', async ({ page }) => {
    await page.goto('/auth/register');
    await expect(page).toHaveTitle(/Create Account/);
  });

  test('robots.txt is accessible', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const text = await res.text();
    // Next.js generates "User-agent" (lowercase 'a')
    expect(text.toLowerCase()).toContain('user-agent');
    // Should disallow app routes
    expect(text).toContain('Disallow: /dashboard');
    expect(text).toContain('Disallow: /api');
  });

  test('sitemap.xml is accessible and valid', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('<?xml');
    expect(text).toContain('<urlset');
    // Should contain key pages
    expect(text).toContain('/pricing');
    expect(text).toContain('/blog');
  });

  test('blog post has SEO metadata', async ({ page }) => {
    await page.goto('/blog/what-is-a-coi');
    // Title should include post title
    const title = await page.title();
    expect(title.length).toBeGreaterThan(5);
  });
});
