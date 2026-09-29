import { chromium } from '@playwright/test';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.env.E2E_BASE_URL;
const password = process.env.SEED_HR_PASSWORD;
if (!baseUrl || !password)
  throw new Error('E2E_BASE_URL and SEED_HR_PASSWORD are required.');

const outputDirectory = resolve('.artifacts/demo');
const rawDirectory = resolve(outputDirectory, 'raw');
const outputPath = resolve(outputDirectory, 'acme-salary-management-demo.webm');
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(rawDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: rawDirectory, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const video = page.video();
if (!video) throw new Error('Playwright did not create a demo video.');
const pause = (milliseconds = 900) => page.waitForTimeout(milliseconds);
const caption = (message) =>
  page.evaluate((text) => {
    let element = document.querySelector('#assessment-demo-caption');
    if (!element) {
      element = document.createElement('div');
      element.id = 'assessment-demo-caption';
      Object.assign(element.style, {
        position: 'fixed',
        left: '50%',
        bottom: '24px',
        transform: 'translateX(-50%)',
        zIndex: '2147483647',
        maxWidth: '900px',
        padding: '12px 20px',
        borderRadius: '8px',
        color: '#fff',
        background: 'rgba(15, 23, 42, 0.94)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
        font: '600 18px/1.4 system-ui, sans-serif',
        textAlign: 'center',
      });
      document.body.append(element);
    }
    element.textContent = text;
  }, message);

try {
  await page.goto(baseUrl);
  await page.getByRole('heading', { name: 'Sign in' }).waitFor();
  await caption('Sign in with the synthetic HR-manager account');
  await pause(1800);
  await page.getByLabel('Email address').fill('hr@acme.example.test');
  await page.getByLabel('Password').fill(password);
  await pause(500);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  await page.getByText(/10,000 employees match/).waitFor();
  await caption(
    'Currency-isolated totals, average, median, and organizational breakdowns',
  );
  await pause(3000);

  await page.getByRole('link', { name: 'Employees' }).click();
  await page.getByRole('heading', { name: 'Employees' }).waitFor();
  await caption('Search, filters, stable sorting, and server-side pagination');
  await pause(1800);
  await page
    .getByRole('textbox', { name: 'Search by name or employee code' })
    .fill('ACME-000001');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  const employeeRow = page.getByRole('row').filter({ hasText: 'ACME-000001' });
  await employeeRow.waitFor();
  await caption('Exact employee-code search across 10,000 employees');
  await pause(2200);
  await employeeRow.getByRole('link').click();

  await page.getByText('ACME-000001').waitFor();
  await caption('Current salary, version, and immutable change history');
  await pause(2800);
  await page.getByRole('button', { name: 'Update salary' }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Update annual base salary',
  });
  const currentText = await dialog.getByText(/Current salary:/).textContent();
  const current = currentText?.match(
    /Current salary: INR ([\d.]+) · Version (\d+)/,
  );
  if (!current) throw new Error('Expected an INR salary in the update dialog.');
  const nextAmount = (Number(current[1]) + 1000).toFixed(2);
  await dialog.getByLabel('New amount (INR)').fill(nextAmount);
  await dialog
    .getByLabel('Reason')
    .fill('Assessment demonstration salary review');
  await caption(
    'Every revision requires a reason and uses stale-version protection',
  );
  await pause(2200);
  await dialog.getByRole('button', { name: 'Confirm update' }).click();
  await page.getByText(`Salary updated to INR ${nextAmount}.`).waitFor();
  await caption(
    'Current salary and actor-attributed history are committed atomically',
  );
  await pause(3000);

  await page.getByRole('link', { name: 'Dashboard' }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  await page.getByText(/10,000 employees match/).waitFor();
  await caption('Affected report data is invalidated and refreshed');
  await pause(2800);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('heading', { name: 'Sign in' }).waitFor();
  await caption('Session revoked — demo complete');
  await pause(1800);
} finally {
  await context.close();
  await video.saveAs(outputPath);
  await browser.close();
}

await rm(rawDirectory, { recursive: true, force: true });
console.info(`Demo video created at ${outputPath}`);
