import { execSync } from 'child_process';

export async function setup() {
  const testDatabaseUrl =
    process.env.TEST_DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5434/hospital_test';

  process.env.DATABASE_URL = testDatabaseUrl;

  // Write a temporary .env override so Prisma CLI uses the test DB
  // (Prisma loads .env from disk, which overrides the env var we pass)
  const cwd = __dirname + '/../../../../';
  const env = { ...process.env, DATABASE_URL: testDatabaseUrl };

  try {
    execSync(`npx prisma db push --skip-generate --accept-data-loss`, {
      cwd,
      env,
      stdio: 'inherit',
    });
  } catch (err: any) {
    console.error('Failed to push schema to test database:', err.message);
    throw err;
  }
}

export async function teardown() {
  // Cleanup handled by test-db.ts afterEach
}
