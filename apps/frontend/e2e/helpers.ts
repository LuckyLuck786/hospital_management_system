import { expect, Page } from '@playwright/test';

/** Sign in through the real login screen using the one-click demo account buttons. */
export async function signInAs(page: Page, role: string, landing: RegExp) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: role, exact: true }).click();
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(landing);
}
