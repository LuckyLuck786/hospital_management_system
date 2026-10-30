import { expect, test } from '@playwright/test';
import { signInAs } from './helpers';

test('accountant reviews an insurance claim and sees pre-authorisations', async ({ page }) => {
  await signInAs(page, 'Accountant', /\/dashboard\/accountant$/);
  await expect(page.getByText('Collections (30 days)')).toBeVisible();
  await page.getByRole('link', { name: 'Insurance Claims' }).click();
  await expect(page.getByRole('heading', { name: 'Insurance & TPA Claims' })).toBeVisible();
  await expect(page.getByText('Cashless pre-authorisations')).toBeVisible();

  const start = page.getByRole('button', { name: 'Start review' }).first();
  if (await start.isVisible().catch(() => false)) {
    const before = await page.getByText('UNDER REVIEW', { exact: true }).count();
    await start.click();
    await expect.poll(async () => page.getByText('UNDER REVIEW', { exact: true }).count()).toBeGreaterThan(before);
  }
});

test('reception files a claim from billing', async ({ page }) => {
  await signInAs(page, 'Receptionist', /\/dashboard\/receptionist$/);
  await page.getByRole('link', { name: 'Billing' }).click();
  await page.getByRole('button', { name: 'FINALIZED' }).click();
  const claim = page.getByRole('button', { name: 'Claim' }).first();
  await expect(claim).toBeVisible();
  await claim.click();
  await expect(page.getByText('File insurance claim')).toBeVisible();
  await expect(page.getByLabel(/Claim amount/)).not.toHaveValue('');
});
