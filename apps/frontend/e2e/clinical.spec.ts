import { expect, test } from '@playwright/test';
import { signInAs } from './helpers';

test.describe('clinical journeys', () => {
  test('nurse records vitals with a live BMI preview', async ({ page }) => {
    await signInAs(page, 'Nurse', /\/dashboard\/nurse$/);
    await page.getByRole('link', { name: 'Patients & Vitals' }).click();
    await page.getByRole('link', { name: /Open chart/ }).first().click();
    await page.getByRole('button', { name: 'Record vitals' }).click();
    const dialog = page.locator('div.fixed.inset-0').last();
    await dialog.getByLabel(/Systolic/).fill('124');
    await dialog.getByLabel(/Diastolic/).fill('82');
    await dialog.getByLabel(/^Pulse/).fill('74');
    await dialog.getByLabel(/Height/).fill('170');
    await dialog.getByLabel(/Weight/).fill('70');
    await expect(dialog.getByText('24.2')).toBeVisible();
    await dialog.getByRole('button', { name: 'Save vitals' }).click();
    await expect(page.getByText('124/82').first()).toBeVisible();
  });

  test('nurse admits, transfers and discharges a patient bed by bed', async ({ page }) => {
    await signInAs(page, 'Nurse', /\/dashboard\/nurse$/);
    await page.getByRole('link', { name: 'Wards & Beds' }).click();
    await expect(page.getByRole('heading', { name: 'Wards & Beds' })).toBeVisible();

    // pick a patient who is not admitted anywhere (read through the same API the page uses)
    const name: string = await page.evaluate(async () => {
      const h = { Authorization: `Bearer ${localStorage.getItem('accessToken')}` };
      const admitted = (await (await fetch('/api/wards/admissions', { headers: h })).json()).data.map((b: any) => b.patient.id);
      const patients = (await (await fetch('/api/patients?limit=50', { headers: h })).json()).data;
      const p = patients.find((x: any) => !admitted.includes(x.id));
      return `${p.user.firstName} ${p.user.lastName}`;
    });

    await page.getByRole('button', { name: /Bed \d+ Free/ }).first().click();
    await page.getByPlaceholder(/Search patient by name/).fill(name.split(' ')[0]);
    await page.getByRole('button', { name: new RegExp(name) }).first().click();
    await page.getByRole('button', { name: `Admit ${name}` }).click();
    const occupied = page.getByRole('button', { name: new RegExp(`Bed \\d+.*${name}`) });
    await expect(occupied).toBeVisible();

    // one-step transfer to another free bed; the old bed goes to cleaning
    const cleaningBefore = await page.getByRole('button', { name: /Being cleaned/ }).count();
    await occupied.click();
    await page.getByLabel('Target bed').selectOption({ index: 1 });
    await page.getByPlaceholder(/Reason/).fill('E2E transfer');
    await page.getByRole('button', { name: 'Transfer patient' }).click();
    await expect.poll(() => page.getByRole('button', { name: /Being cleaned/ }).count()).toBe(cleaningBefore + 1);

    // discharge from the new bed, then mark both cleaned beds ready
    await page.getByRole('button', { name: new RegExp(`Bed \\d+.*${name}`) }).click();
    await page.getByRole('button', { name: /Discharge/ }).click();
    await expect(page.getByRole('button', { name: new RegExp(name) })).toHaveCount(0);
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: /Being cleaned/ }).first().click();
      await page.getByRole('button', { name: /Mark ready/ }).click();
      await expect(page.getByRole('button', { name: /Mark ready/ })).toHaveCount(0);
    }
  });
});
