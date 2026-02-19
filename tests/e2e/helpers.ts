import { Page, expect, type Response } from '@playwright/test';

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to a path and verify the response status is not a server error.
 * Returns the response object for further assertions.
 */
export async function navigateAndVerify(
  page: Page,
  path: string
): Promise<Response | null> {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBeLessThan(500);
  return response;
}

/**
 * Wait until the network is idle (useful after client-side data fetches).
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

/**
 * Wait for an API response on a specific URL pattern.
 */
export async function waitForApi(
  page: Page,
  urlPattern: string | RegExp
): Promise<Response> {
  return page.waitForResponse(urlPattern);
}

// ---------------------------------------------------------------------------
// Console error capture
// ---------------------------------------------------------------------------

/**
 * Attach a listener that collects console.error messages.
 * Call this in beforeEach and inspect the returned array in afterEach.
 */
export function setupConsoleErrorCapture(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore known harmless errors
      if (
        text.includes('Download the React DevTools') ||
        text.includes('react-dom.development.js') ||
        text.includes('Failed to load resource') // expected for 401 on unauth pages
      ) {
        return;
      }
      errors.push(text);
    }
  });
  return errors;
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Assert that the page URL matches the expected pattern.
 */
export async function expectUrl(
  page: Page,
  pattern: string | RegExp
): Promise<void> {
  if (typeof pattern === 'string') {
    await expect(page).toHaveURL(pattern);
  } else {
    await expect(page).toHaveURL(pattern);
  }
}

/**
 * Assert that a data-testid element is visible on the page.
 */
export async function expectTestId(
  page: Page,
  testId: string
): Promise<void> {
  await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible();
}

/**
 * Assert that a heading with the given text is visible.
 */
export async function expectHeading(
  page: Page,
  text: string | RegExp
): Promise<void> {
  await expect(
    page.getByRole('heading', { name: text }).first()
  ).toBeVisible();
}

// ---------------------------------------------------------------------------
// Viewport helpers
// ---------------------------------------------------------------------------

export const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
} as const;
