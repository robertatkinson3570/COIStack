import { test, expect } from '@playwright/test';
import { navigateAndVerify, expectHeading } from './helpers';

test.describe('Authentication Pages', () => {
  // -------------------------------------------------------------------------
  // Login Page
  // -------------------------------------------------------------------------

  test('login page renders all form elements', async ({ page }) => {
    await navigateAndVerify(page, '/auth/login');

    // Logo
    await expect(page.getByText('COIStack').first()).toBeVisible();

    // Heading
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(
      page.getByText('Sign in to your COIStack account')
    ).toBeVisible();

    // Form fields
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    // Buttons
    await expect(
      page.getByRole('button', { name: 'Sign In', exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sign in with email link' })
    ).toBeVisible();

    // Links
    await expect(page.getByText('Forgot password?')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
  });

  test('login page has correct title', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page).toHaveTitle(/Sign In/);
  });

  test('login form shows Zod validation errors on empty submit', async ({
    page,
  }) => {
    await page.goto('/auth/login');

    // Submit the form with empty fields
    await page
      .getByRole('button', { name: 'Sign In', exact: true })
      .click();

    // Zod validation error messages
    await expect(page.getByText('Please enter a valid email')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('login form shows validation for short password', async ({ page }) => {
    await page.goto('/auth/login');

    // Fill in only the email, leave password empty
    await page.locator('#email').fill('test@example.com');
    await page
      .getByRole('button', { name: 'Sign In', exact: true })
      .click();

    // Password is required
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('login page navigates to register', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('link', { name: 'Sign up' }).click();
    await expect(page).toHaveURL(/\/auth\/register/);
  });

  test('login page navigates to forgot password', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByText('Forgot password?').click();
    await expect(page).toHaveURL(/\/auth\/forgot-password/);
  });

  // -------------------------------------------------------------------------
  // Register Page
  // -------------------------------------------------------------------------

  test('register page renders all form elements', async ({ page }) => {
    await navigateAndVerify(page, '/auth/register');

    await expect(page.getByText('Create your account')).toBeVisible();
    await expect(
      page.getByText('Start your free 14-day trial')
    ).toBeVisible();

    // Form fields
    await expect(page.locator('#fullName')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#companyName')).toBeVisible();

    // Submit button
    await expect(
      page.getByRole('button', { name: 'Create Account' })
    ).toBeVisible();

    // Login link
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

    // Terms / Privacy links
    await expect(page.getByRole('link', { name: 'Terms' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Privacy Policy' })
    ).toBeVisible();
  });

  test('register page has correct title', async ({ page }) => {
    await page.goto('/auth/register');
    await expect(page).toHaveTitle(/Create Account/);
  });

  test('register form shows validation errors on empty submit', async ({
    page,
  }) => {
    await page.goto('/auth/register');

    await page.getByRole('button', { name: 'Create Account' }).click();

    // At least one validation message
    await expect(
      page.getByText(/at least|required|valid/i).first()
    ).toBeVisible();
  });

  test('register form validates short password', async ({ page }) => {
    await page.goto('/auth/register');

    await page.locator('#fullName').fill('John Doe');
    await page.locator('#email').fill('john@company.com');
    await page.locator('#password').fill('123'); // Too short
    await page.locator('#companyName').fill('Acme Inc');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(
      page.getByText('Password must be at least 8 characters')
    ).toBeVisible();
  });

  test('register page navigates to login', async ({ page }) => {
    await page.goto('/auth/register');
    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  // -------------------------------------------------------------------------
  // Forgot Password Page
  // -------------------------------------------------------------------------

  test('forgot password page renders correctly', async ({ page }) => {
    await navigateAndVerify(page, '/auth/forgot-password');

    await expect(page.getByText('Reset password')).toBeVisible();
    await expect(
      page.getByText("Enter your email and we'll send you a reset link")
    ).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Send Reset Link' })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Back to sign in' })
    ).toBeVisible();
  });

  test('forgot password shows validation on empty submit', async ({
    page,
  }) => {
    await page.goto('/auth/forgot-password');
    await page.getByRole('button', { name: 'Send Reset Link' }).click();

    await expect(page.getByText('Please enter a valid email')).toBeVisible();
  });

  test('forgot password navigates back to login', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await page.getByRole('link', { name: 'Back to sign in' }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
