# Testing Pyramid Demo Script

All commands assume you start in `HospitalManager/`.

---

## Pre-demo setup

Make sure everything passes green first:

```bash
# Start test DB (needed for integration + contract)
npm run test:db:up

# Confirm green baseline
npm run test:unit          # ~2s
npm run test:contract      # ~5s
npm run test:integration   # ~10s
cd e2e && npx playwright test --project=chromium   # ~30s
```

Optional — add a pre-push hook so `git push` is blocked by failing tests:

```bash
npm install -D husky
npx husky init
echo "cd HospitalManager && npm run test:unit" > .husky/pre-push
```

> **Note:** Without this hook, nothing prevents `git push` locally.
> CI catches failures *after* push on GitHub Actions.
> The hook gives you the live "push blocked" moment.

---

## Layer 1: Unit Tests (bottom of pyramid)

### 1a. Show the tests

Open `backend/src/__tests__/unit/pagination.test.ts`

Key points:
- Tests the `getPagination` function — pure logic, no database, no HTTP, no browser
- No imports of databases, servers, or external services
- Each test is a single input/output: "give it page=3 pageSize=10, expect skip=20"

### 1b. Run them

```bash
npm run test:unit
```

All 58 tests pass in ~2 seconds. Fastest layer.

### 1c. Break something

Open `backend/src/lib/pagination.ts`, line 5. Change default pageSize from 25 to 50:

```typescript
// BEFORE:
const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));

// AFTER:
const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));
```

Run:

```bash
npm run test:unit
```

Multiple tests fail:

```
Expected: { page: 1, pageSize: 25, skip: 0, take: 25 }
Received: { page: 1, pageSize: 50, skip: 0, take: 50 }
```

"I changed one number, and the unit test caught it in under 2 seconds."

### 1d. When does this run?

Open `.github/workflows/ci.yml` — the `unit-tests` job (lines 38-59).

- **When:** Every push to `main` AND every PR to `main`
- **Where to see it:** GitHub → repo → Actions tab → "CI" workflow → "Unit Tests" job

### 1e. Push blocked (if pre-push hook is set up)

```bash
git add backend/src/lib/pagination.ts
git commit -m "change default page size"
git push
```

Push is **blocked**. Pre-push hook runs unit tests, they fail, push rejected.

### 1f. Revert

```bash
git checkout backend/src/lib/pagination.ts
```

---

## Layer 2: Integration Tests (middle of pyramid)

### 2a. Show the tests

Open `backend/src/__tests__/integration/patients.test.ts`

Key points:
- Spins up the real Express server
- Hits real HTTP endpoints with Supertest
- Talks to a real PostgreSQL database (running in Docker)
- Tests the full request lifecycle: HTTP → routing → validation → database → response
- Line 14-24: creates a real patient, real doctor, then GETs and checks response

### 2b. Run them

```bash
npm run test:integration
```

~10 seconds. PostgreSQL container must be running (`npm run test:db:up`).

### 2c. Break something

Open `backend/src/routes/patients.ts`, line 68. Change the error message:

```typescript
// BEFORE:
if (!patient) throw new AppError('Patient not found', 404);

// AFTER:
if (!patient) throw new AppError('Not found', 404);
```

Run:

```bash
npm run test:integration
```

Fails:

```
Expected: "Patient not found"
Received: "Not found"
```

"Unit tests wouldn't catch this — it's about how the route handler, database, and error middleware all work together."

### 2d. When does this run?

Same `ci.yml`, the `integration-tests` job (lines 101-139).

- **When:** Every push/PR to `main`
- **Extra infra:** Spins up a `services: postgres` container in GitHub Actions
- **Depends on:** `needs: [typecheck]` — only runs after typecheck passes
- **Where to see it:** GitHub Actions → "CI" workflow → "Integration Tests" job

### 2e. Revert

```bash
git checkout backend/src/routes/patients.ts
```

---

## Layer 3: Contract Tests

### 3a. Show the tests

Open `backend/src/__tests__/contract/api-contracts.test.ts`

Then open `backend/src/__tests__/contract/response-schemas.ts`

Key points:
- Verify the **shape** of API responses, not business logic
- "Does the API return the fields the frontend expects, in the right types?"
- Uses Zod schemas to validate response shapes
- If someone renames or removes a field, the contract breaks — even if the logic is fine
- This is the guardrail between backend and frontend

### 3b. Run them

```bash
npm run test:contract
```

### 3c. Break something

Open `backend/src/lib/pagination.ts`, line 14. Rename the response key:

```typescript
// BEFORE:
pagination: {

// AFTER:
meta: {
```

Run:

```bash
npm run test:contract
```

Every paginated contract test fails:

```
Zod validation failed - response missing 'pagination' field
```

"The backend still works — the data is all there. But the frontend expects `pagination`, not `meta`. The contract test prevents accidental API breakage."

### 3d. When does this run?

Same `ci.yml`, the `contract-tests` job (lines 61-99).

- **When:** Every push/PR to `main`
- **Also needs:** PostgreSQL service + typecheck to pass first
- Contract, integration, and unit tests run **in parallel** on separate runners

### 3e. Revert

```bash
git checkout backend/src/lib/pagination.ts
```

---

## Layer 4: E2E Tests (top of pyramid)

### 4a. Show the tests

Open `e2e/tests/departments.spec.ts`

Also show `e2e/tests/smoke.spec.ts`

Key points:
- Opens a real browser, navigates to the running app, clicks like a user
- `departments.spec.ts` line 20-30: clicks "Add Department", fills the form, clicks Save, verifies dialog closes
- `smoke.spec.ts`: visits all 12 pages, checks none throw console errors — the canary in the coal mine

### 4b. Run them

```bash
cd e2e && npx playwright test --project=chromium
```

~30 seconds. Browser flashes open (or runs headless).

### 4c. Break something

Find the "Add Department" button in the frontend and change its text to "New Department".

Run:

```bash
cd e2e && npx playwright test tests/departments.spec.ts --project=chromium
```

Fails:

```
Timed out waiting for getByText('Add Department')
```

"Nobody changed the backend. Nobody changed the logic. Someone just renamed a button. The E2E test caught it because it tests what the user actually sees and clicks."

### 4d. When does this run?

Open `.github/workflows/nightly.yml`

- **When:** Every night at 3am CST (`cron: '0 9 * * *'`), plus manual trigger
- **Why nightly?** E2E tests are slow and can be flaky. Running on every push would slow down the team.
- **Matrix:** Runs on 3 browsers in parallel: Chromium, Firefox, WebKit (line 20)
- **Artifacts:** On failure, uploads Playwright traces + screenshots (lines 71-83) — downloadable from the GitHub Actions run
- **Where to see it:** GitHub Actions → "Nightly E2E" workflow → 3 browser matrix jobs

### 4e. Revert

```bash
git checkout -- .
```

---

## Recap

```
        /  E2E  \          <- Nightly (nightly.yml) — slow, real browser, 3 browsers
       / Contract \        <- Every push (ci.yml) — API shape validation
      / Integration \      <- Every push (ci.yml) — real DB + HTTP
     /    Unit Tests  \    <- Every push (ci.yml) — fast, isolated, no infra
```

| Layer       | Tests | Speed  | Needs                  | Runs            | Config file  |
|-------------|-------|--------|------------------------|-----------------|--------------|
| Unit        | 58    | ~2s    | Nothing                | Every push/PR   | ci.yml       |
| Integration | ~85   | ~10s   | PostgreSQL (Docker)    | Every push/PR   | ci.yml       |
| Contract    | ~15   | ~5s    | PostgreSQL (Docker)    | Every push/PR   | ci.yml       |
| E2E         | 5 files| ~30s  | Full app + browser     | Nightly + manual| nightly.yml  |

**Local safety net:** Pre-push hook blocks you from pushing broken unit tests.
**CI safety net:** GitHub Actions catches integration/contract failures after push.
**Nightly safety net:** E2E catches regressions overnight across 3 browsers.
