import { test, expect } from '@playwright/test';

test.describe('Patient Workflow', () => {
  test('patients page loads with search', async ({ page }) => {
    await page.goto('/patients');
    await expect(page.getByText('Patients').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.MuiDataGrid-root')).toBeVisible();
  });

  test('can open create patient dialog', async ({ page }) => {
    await page.goto('/patients');
    await expect(page.getByText('Add Patient', { exact: false })).toBeVisible({ timeout: 10000 });
    await page.getByText('Add Patient').click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('patient form has personal info fields', async ({ page }) => {
    await page.goto('/patients');
    await page.getByText('Add Patient').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Should have name fields
    await expect(page.getByLabel('First Name')).toBeVisible();
    await expect(page.getByLabel('Last Name')).toBeVisible();
  });

  test('can search patients', async ({ page }) => {
    await page.goto('/patients');
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('John');
    await page.waitForTimeout(500);
  });
});
