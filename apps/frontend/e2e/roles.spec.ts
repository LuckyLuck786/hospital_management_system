import { expect, test } from '@playwright/test';
import { signInAs } from './helpers';

test.describe('role workspaces', () => {
  test('hospital admin sees KPIs, bed occupancy and the audit log', async ({ page }) => {
    await signInAs(page, 'Hospital Admin', /\/dashboard\/admin$/);
    await expect(page.getByRole('heading', { name: 'Hospital Dashboard' })).toBeVisible();
    await expect(page.getByText('Beds Occupied')).toBeVisible();
    await expect(page.getByText('Department occupancy')).toBeVisible();
    await page.getByRole('link', { name: 'Audit Log' }).click();
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible();
  });

  test('doctor sees today, the follow-up calendar and can open a patient chart', async ({ page }) => {
    await signInAs(page, 'Doctor', /\/dashboard\/doctor$/);
    await expect(page.getByText('Upcoming follow-ups')).toBeVisible();
    await page.locator('aside').getByRole('link', { name: 'Patients', exact: true }).click();
    await page.getByRole('link', { name: /Open chart/ }).first().click();
    await expect(page.getByRole('button', { name: 'Vitals', exact: true })).toBeVisible();
    await expect(page.getByText('Family history')).toBeVisible();
  });

  test('pharmacist navigation has no patient registry and inventory works', async ({ page }) => {
    await signInAs(page, 'Pharmacist', /\/dashboard\/pharmacy$/);
    await expect(page.getByRole('link', { name: 'Patients' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Inventory' }).click();
    await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
    await page.getByRole('button', { name: /Low stock/ }).click();
    await expect(page.locator('tbody tr').first()).toBeVisible();
  });

  test('patient sees records with vitals and their bills', async ({ page }) => {
    await signInAs(page, 'Patient', /\/dashboard\/patient$/);
    await page.locator('aside').getByRole('link', { name: 'Medical Records' }).click();
    await page.getByRole('button', { name: /Vitals & trends/ }).click();
    await expect(page.getByText('Vital signs')).toBeVisible();
    await page.locator('aside').getByRole('link', { name: 'Bills & Payments' }).click();
    await expect(page.getByRole('heading', { name: 'My Bills' })).toBeVisible();
  });
});
