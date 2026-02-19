import { Page, expect } from '@playwright/test';

/** Navigate and verify page loads without errors */
export async function navigateAndVerify(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status()).toBeLessThan(500);
  return response;
}

/** Wait for page to be hydrated (client-side JS loaded) */
export async function waitForHydration(page: Page) {
  await page.waitForLoadState('networkidle');
}

/** Check page has no console errors */
export function setupConsoleErrorCapture(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}
