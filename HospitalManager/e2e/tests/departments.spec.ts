import { test, expect } from '@playwright/test';

test.describe('Departments CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/departments');
    await expect(page.getByText('Departments').first()).toBeVisible({ timeout: 10000 });
  });

  test('displays departments list', async ({ page }) => {
    // The page should show the DataGrid
    await expect(page.locator('.MuiDataGrid-root')).toBeVisible();
  });

  test('can open create dialog', async ({ page }) => {
    await page.getByText('Add Department').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Name' })).toBeVisible();
  });

  test('can create a new department', async ({ page }) => {
    await page.getByText('Add Department').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill(`E2E Test Dept ${Date.now()}`);
    await page.getByRole('textbox', { name: 'Description' }).fill('Created by E2E test');
    await page.getByRole('textbox', { name: 'Phone' }).fill('555-E2E0');
    await page.getByRole('button', { name: 'Save' }).click();

    // Dialog should close (indicates success)
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
  });

  test('can search departments', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search departments...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('test');
    // Table should update (network request triggered)
    await page.waitForTimeout(500);
  });

  test('can close create dialog with Cancel', async ({ page }) => {
    await page.getByText('Add Department').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
