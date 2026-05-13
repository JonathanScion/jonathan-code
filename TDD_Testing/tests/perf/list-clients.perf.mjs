import autocannon from 'autocannon';

const url = process.env.API_BASE_URL ?? 'http://localhost:4000';

const result = await autocannon({
  url: `${url}/api/clients?q=anderson&sort=lastName&dir=asc`,
  connections: 20,
  duration: 5,
  pipelining: 1,
});

console.log(autocannon.printResult(result));

const P99_BUDGET_MS = 100;
const ERROR_BUDGET = 0;

const failures = [];
if (result.errors > ERROR_BUDGET) {
  failures.push(`errors: ${result.errors} > ${ERROR_BUDGET}`);
}
if (result.non2xx > 0) {
  failures.push(`non-2xx: ${result.non2xx}`);
}
if (result.latency.p99 > P99_BUDGET_MS) {
  failures.push(`p99 latency ${result.latency.p99}ms > ${P99_BUDGET_MS}ms`);
}

if (failures.length > 0) {
  console.error('\nPerformance budget exceeded:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('\nPerformance budget OK.');
