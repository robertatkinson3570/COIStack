import { test, expect } from '@playwright/test';

test.describe('Authentication Pages', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/auth/login');

    // Logo
    await expect(page.getByText('COIStack').first()).toBeVisible();

    // Form elements
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with email link' })).toBeVisible();
    await expect(page.getByText('Forgot password?')).toBeVisible();

    // Link to register
    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
  });

  test('register page renders correctly', async ({ page }) => {
    await page.goto('/auth/register');

    await expect(page.getByText('Create your account')).toBeVisible();
    await expect(page.locator('#fullName')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#companyName')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();

    // Link to login
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  test('forgot password page renders correctly', async ({ page }) => {
    await page.goto('/auth/forgot-password');

    await expect(page.getByText('Reset password')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Reset Link' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible();
  });

  test('login form shows validation errors on submit', async ({ page }) => {
    await page.goto('/auth/login');

    // Submit the form empty — bypasses native type="email" validation (which only
    // checks format when the field is non-empty) and lets react-hook-form/Zod validate
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Expect Zod validation error messages
    await expect(page.getByText('Please enter a valid email')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('register form shows validation errors on submit', async ({ page }) => {
    await page.goto('/auth/register');

    // Submit empty form
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Expect at least one validation message
    await expect(page.getByText(/at least|required|valid/i).first()).toBeVisible();
  });

  test('login page navigates to register', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('link', { name: 'Sign up' }).click();
    await expect(page).toHaveURL(/\/auth\/register/);
  });

  test('register page navigates to login', async ({ page }) => {
    await page.goto('/auth/register');
    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('forgot password navigates back to login', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await page.getByRole('link', { name: 'Back to sign in' }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
