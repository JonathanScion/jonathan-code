const BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

const checks = [
  { name: 'health', path: '/api/health' },
  { name: 'lookups', path: '/api/lookups' },
  { name: 'clients-list', path: '/api/clients' },
];

let failed = 0;
for (const check of checks) {
  try {
    const res = await fetch(`${BASE}${check.path}`);
    if (!res.ok) {
      console.error(`FAIL ${check.name} ${check.path}: HTTP ${res.status}`);
      failed++;
      continue;
    }
    const body = await res.json();
    if (body == null) {
      console.error(`FAIL ${check.name} ${check.path}: empty body`);
      failed++;
      continue;
    }
    console.log(`OK   ${check.name} ${check.path}`);
  } catch (err) {
    console.error(`FAIL ${check.name} ${check.path}: ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} smoke check(s) failed.`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
