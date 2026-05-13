import { test, expect } from '@playwright/test';

test('full client CRUD flow', async ({ page }) => {
  await page.goto('/');

  // List loaded with seed data
  await expect(page.getByTestId('clients-table')).toBeVisible();
  await expect(page.getByTestId('cell-name').first()).toBeVisible();

  // Create new client
  await page.getByTestId('new-client').click();
  await expect(page).toHaveURL(/\/new$/);

  await page.getByTestId('input-firstName').fill('E2E');
  await page.getByTestId('input-lastName').fill('Tester');
  await page.getByTestId('input-email').fill('e2e@example.com');
  await page.getByTestId('input-phone').fill('+1-555-0150');
  await page.getByTestId('select-clientType').selectOption('Individual');
  await page.getByTestId('select-status').selectOption('Active');
  await page.getByTestId('select-industry').selectOption('Technology');
  await page.getByTestId('form-submit').click();

  // Back on list with new row visible
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('E2E Tester')).toBeVisible();

  // Conditional revenue field appears when switching to Business
  await page.getByTestId('new-client').click();
  await expect(page.getByTestId('input-annualRevenue')).toBeHidden();
  await page.getByTestId('select-clientType').selectOption('Business');
  await expect(page.getByTestId('input-annualRevenue')).toBeVisible();
  await page.getByTestId('form-cancel').click();

  // Delete the row we just created
  const row = page.locator('tr.client-row', { hasText: 'E2E Tester' });
  await row.getByRole('button', { name: /Delete/ }).click();
  await expect(page.getByText('E2E Tester')).toHaveCount(0);
});
