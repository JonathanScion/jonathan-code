import { test, expect } from '@playwright/test';

const pages = [
  { name: 'Dashboard', path: '/', title: 'Dashboard' },
  { name: 'Departments', path: '/departments', title: 'Departments' },
  { name: 'Rooms', path: '/rooms', title: 'Rooms' },
  { name: 'Medications', path: '/medications', title: 'Medications' },
  { name: 'Insurance Plans', path: '/insurance-plans', title: 'Insurance Plans' },
  { name: 'Suppliers', path: '/suppliers', title: 'Suppliers' },
  { name: 'Patients', path: '/patients', title: 'Patients' },
  { name: 'Doctors', path: '/doctors', title: 'Doctors' },
  { name: 'Appointments', path: '/appointments', title: 'Appointments' },
  { name: 'Admissions', path: '/admissions', title: 'Admissions' },
  { name: 'Visits', path: '/visits', title: 'Visits' },
  { name: 'Bills', path: '/bills', title: 'Bills' },
];

test.describe('Smoke Tests', () => {
  for (const page of pages) {
    test(`${page.name} page loads without errors`, async ({ page: p }) => {
      const consoleErrors: string[] = [];
      p.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await p.goto(page.path);
      await expect(p.getByText(page.title).first()).toBeVisible({ timeout: 10000 });

      // Filter out expected React dev warnings and known harmless API errors
      const realErrors = consoleErrors.filter(
        (e) =>
          !e.includes('React Router Future Flag') &&
          !e.includes('Download the React DevTools') &&
          !e.includes('Failed to load resource'),
      );
      expect(realErrors).toHaveLength(0);
    });
  }
});
