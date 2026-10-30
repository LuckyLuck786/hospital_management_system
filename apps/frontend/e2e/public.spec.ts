import { expect, test } from '@playwright/test';

test.describe('public pages', () => {
  test('landing page explains the product and links to sign-in and API docs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Run every desk of your hospital');
    await expect(page.getByRole('link', { name: /API documentation/i }).first()).toHaveAttribute('href', /\/api\/docs$/);
    await page.getByRole('link', { name: /Explore the live demo/i }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test('login validates input and rejects a wrong password without reloading', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page.getByText('Invalid email address')).toBeVisible();
    await page.getByLabel('Email').fill('admin@medcore.com');
    await page.getByLabel('Password', { exact: true }).fill('WrongPassword1');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page.getByText(/invalid/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test('forgot-password flow confirms without revealing whether the account exists', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await page.getByLabel('Email').fill('nobody@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();
    await expect(page.getByText(/If an account exists/)).toBeVisible();
  });

  test('dashboards redirect to sign-in when signed out', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await expect(page).toHaveURL(/\/auth\/login$/);
  });
});
