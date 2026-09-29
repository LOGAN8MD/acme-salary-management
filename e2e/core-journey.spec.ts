import { expect, test } from '@playwright/test';

test('HR can find an employee, revise salary, verify history and refreshed reporting', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('form', { name: 'HR sign in' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Email address')).toBeFocused();
  await page.getByLabel('Email address').fill('hr@acme.example.test');
  await page.getByLabel('Password').fill('AcmeQualityTest2026!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeFocused();
  await expect(page.getByText(/10,000 employees match/)).toBeVisible();
  const originalReportTotal = await page
    .getByText('Total annual base salary')
    .locator('..')
    .getByRole('paragraph')
    .last()
    .textContent();

  await page.getByRole('link', { name: 'Employees' }).click();
  await expect(page.getByRole('heading', { name: 'Employees' })).toBeFocused();
  await page
    .getByRole('textbox', { name: 'Search by name or employee code' })
    .fill('ACME-000001');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  const employeeRow = page.getByRole('row').filter({ hasText: 'ACME-000001' });
  await expect(employeeRow).toHaveCount(1);
  await employeeRow.getByRole('link').click();

  await expect(page.getByText('ACME-000001')).toBeVisible();
  await page.getByRole('button', { name: 'Update salary' }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Update annual base salary',
  });
  await expect(dialog).toBeVisible();
  const current = await dialog.getByText(/Current salary:/).textContent();
  const match = current?.match(/Current salary: INR ([\d.]+) · Version (\d+)/);
  expect(
    match,
    'expected an INR salary and version in the dialog',
  ).toBeTruthy();
  const nextAmount = (Number(match![1]) + 1).toFixed(2);
  await dialog.getByLabel('New amount (INR)').fill(nextAmount);
  await dialog.getByLabel('Reason').fill('Task 11 end-to-end verification');
  await dialog.getByRole('button', { name: 'Confirm update' }).click();

  await expect(
    page.getByText(`Salary updated to INR ${nextAmount}.`),
  ).toBeVisible();
  const latestHistory = page
    .getByRole('table', { name: 'Salary history' })
    .getByRole('row')
    .nth(1);
  await expect(latestHistory).toContainText('Task 11 end-to-end verification');
  await expect(latestHistory).toContainText('hr@acme.example.test');

  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  const refreshedReportTotal = page
    .getByText('Total annual base salary')
    .locator('..')
    .getByRole('paragraph')
    .last();
  await expect(refreshedReportTotal).not.toHaveText(originalReportTotal ?? '');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
});
