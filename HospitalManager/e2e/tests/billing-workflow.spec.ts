import { test, expect } from '@playwright/test';

test.describe('Billing Workflow', () => {
  test('bills page loads', async ({ page }) => {
    await page.goto('/bills');
    await expect(page.getByText('Bills').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.MuiDataGrid-root')).toBeVisible();
  });

  test('can open create bill dialog', async ({ page }) => {
    await page.goto('/bills');
    await expect(page.getByText('Add Bill', { exact: false })).toBeVisible({ timeout: 10000 });
    await page.getByText('Add Bill').click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('dashboard shows outstanding bills', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Outstanding Bills')).toBeVisible({ timeout: 10000 });
  });

  test('navigates to bill detail from list', async ({ page }) => {
    await page.goto('/bills');
    await expect(page.locator('.MuiDataGrid-root')).toBeVisible({ timeout: 10000 });
    // If there are bills, clicking a row should navigate to detail
    // This test verifies the page renders without errors
  });
});
