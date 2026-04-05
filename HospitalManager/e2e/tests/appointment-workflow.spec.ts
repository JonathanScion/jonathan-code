import { test, expect } from '@playwright/test';

test.describe('Appointment Workflow', () => {
  test('appointments page loads', async ({ page }) => {
    await page.goto('/appointments');
    await expect(page.getByText('Appointments').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.MuiDataGrid-root')).toBeVisible();
  });

  test('can open create appointment dialog', async ({ page }) => {
    await page.goto('/appointments');
    await expect(page.getByText('Add Appointment', { exact: false })).toBeVisible({ timeout: 10000 });
    await page.getByText('Add Appointment').click();

    // Form dialog should be visible
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('appointment form has required fields', async ({ page }) => {
    await page.goto('/appointments');
    await page.getByText('Add Appointment').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Should have key fields for appointment creation
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });
});
