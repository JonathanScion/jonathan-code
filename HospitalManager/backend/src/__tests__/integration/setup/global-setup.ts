import { execSync } from 'child_process';

export async function setup() {
  const testDatabaseUrl =
    process.env.TEST_DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5434/hospital_test';

  process.env.DATABASE_URL = testDatabaseUrl;

  // Run migrations on the test database
  try {
    execSync('npx prisma migrate deploy', {
      cwd: __dirname + '/../../../../',
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: 'pipe',
    });
  } catch (err: any) {
    // If migrate deploy fails (no migrations yet), try db push
    execSync('npx prisma db push --force-reset', {
      cwd: __dirname + '/../../../../',
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: 'pipe',
    });
  }
}

export async function teardown() {
  // Cleanup handled by test-db.ts afterEach
}
