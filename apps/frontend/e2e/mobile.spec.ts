import { expect, test } from '@playwright/test';
import { signInAs } from './helpers';

test('mobile layout uses a navigation drawer', async ({ page }) => {
  await signInAs(page, 'Hospital Admin', /\/dashboard\/admin$/);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('link', { name: 'Wards & Beds' }).click();
  await expect(page.getByRole('heading', { name: 'Wards & Beds' })).toBeVisible();
});
