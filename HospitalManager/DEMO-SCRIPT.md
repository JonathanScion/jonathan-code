# Testing Pyramid Demo Script

All commands assume you start in `HospitalManager/`.

---

## What are we testing and why?

This app is a full-stack hospital management system: React frontend, Express API backend, PostgreSQL database. Each layer of the testing pyramid targets a different kind of bug, using the simplest tool that can catch it.

**Unit tests** call individual functions directly with fake inputs and check the return values. No server, no database, no browser. They exist because most logic bugs — wrong defaults, bad math, broken validation rules — live inside a single function. Testing at this level is instant (~2s) and pinpoints exactly which function broke.

**Integration tests** make real HTTP requests to the running Express server, which talks to a real PostgreSQL database in Docker. They exist because many bugs only appear when components interact: a route handler that builds the wrong query, a middleware that strips a field, a database constraint that rejects valid data. Unit tests can't catch these — you need the real request lifecycle: HTTP request → routing → validation → database → response.

**Contract tests** also hit the real API, but they don't check business logic. They validate the *shape* of every API response against Zod schemas: "Does GET /patients return an object with `data` (array) and `pagination` (object with page, pageSize, total, totalPages)?" They exist because the frontend and backend are separate codebases. A backend developer might rename a field or change a type and all backend tests pass — but the frontend breaks. Contract tests are the guardrail between the two.

**E2E tests** open a real browser with Playwright, navigate to the running app, and interact like a user: click buttons, fill forms, check that dialogs open and close. They exist because some bugs are invisible to API tests: a button with the wrong label, a form that doesn't submit, a page that throws a console error on load. The smoke tests visit every page and check for JavaScript errors — the canary in the coal mine.

---

## Pre-demo setup

Make sure everything passes green first:

```bash
# One-time setup: generate Prisma client (needed after fresh npm install)
cd backend && npx prisma generate && cd ..

# Start test DB (needed for integration + contract)
npm run test:db:up

# Confirm green baseline
npm run test:unit                                    # backend unit tests, ~2s
npm run test:unit:frontend                           # frontend hook tests, ~80s
npm run test:contract                                # API shape validation, ~5s
npm run test:integration                             # real DB + HTTP, ~10s
cd e2e && npx playwright test --project=chromium     # E2E + smoke, ~30s
```

Optional — add a pre-push hook so `git push` is blocked by failing tests:

```bash
npm install -D husky
npx husky init
echo "cd HospitalManager && npm run test:unit" > .husky/pre-push
```

> **Why only unit tests in the hook?** It's a tradeoff. Unit tests take ~2s and need nothing.
> Contract and integration tests need Docker PostgreSQL running — if the container is down,
> the hook blocks your push for the wrong reason. E2E needs the full app + browser — way too
> slow for a pre-push gate. The hook is the lightest, fastest sanity check. CI does the rest.

> **Hook vs. CI — aren't they redundant?** No. The hook runs *before* your code leaves your
> machine — instant feedback, 2 seconds. CI runs *after* the push arrives at GitHub — it's
> the enforced gate that can't be skipped (hooks can be bypassed with `--no-verify`).
> The hook is for developer convenience; CI is for enforcement. They're complementary.

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
npm run test:unit              # backend only, ~2s
npm run test:unit:frontend     # frontend (React hooks), ~80s
npm run test:unit:all          # both
```

Backend: 58 tests in ~2 seconds. Fastest layer.
Frontend: 5 tests in ~80 seconds (jsdom + React overhead).

### 1c. Break something

Open `backend/src/lib/pagination.ts`, line 5. This is the `getPagination` function — it reads
`page` and `pageSize` from the URL query string (e.g. `/api/patients?page=3&pageSize=10`),
clamps them to safe ranges, and calculates `skip` (how many rows the database should skip).
The `|| 25` at the end is the default: if no pageSize is in the URL, show 25 items per page.

Change the default from 25 to 50:

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

**Why it breaks:** The unit tests call `getPagination` with no query params and assert the
defaults are `pageSize: 25`. We changed the default to 50, so every test that relies on the
default value now gets the wrong number. This is a pure logic bug — no server or database
needed to catch it, just "call the function, check the output."

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

Open `backend/src/routes/patients.ts`, line 68. This is the "get patient by ID" route handler.
It queries the real database for a patient with the given ID. If no patient exists, it throws
an `AppError` with a 404 status and a message. That error flows through the Express error
middleware, which serializes it into the JSON response the frontend receives.

Change the error message:

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

**Why it breaks:** The integration test makes a real `GET /api/patients/99999` HTTP request
to the running server, which hits the real database, finds no patient, and returns the error
JSON response. The test asserts the exact error message. A unit test couldn't catch this —
the bug lives in the interaction between the route handler, database lookup, error middleware,
and HTTP response. You need the full request lifecycle running to see it.

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

Open `backend/src/lib/pagination.ts`, line 12. This is the `paginatedResponse` function — every
list endpoint (patients, departments, medications, etc.) calls it to wrap its results. It returns
`{ data: [...], pagination: { page, pageSize, total, totalPages } }`. The frontend reads
`response.pagination.total` to show "Page 1 of 5" — it depends on that exact key name.

Rename the response key:

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

**Why it breaks:** The contract tests define a Zod schema that says "every paginated response
must have a `pagination` object with `page`, `pageSize`, `total`, `totalPages`." We renamed it
to `meta`, so the Zod validation fails. The backend still works perfectly — all the data is
there, all the logic is correct, integration tests would still pass. But the frontend expects
`pagination`, not `meta`. Without this contract test, the backend developer ships "working" code
that silently breaks every list page in the frontend.

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

Open `frontend/src/pages/DepartmentsPage.tsx`, line 136. This is where the Departments page
renders its toolbar. The `addLabel="Add Department"` prop controls the text on the button users
click to create a new department. The E2E test finds this button by its visible text:
`page.getByText('Add Department').click()`.

Change the button label:

```typescript
// BEFORE:
addLabel="Add Department"

// AFTER:
addLabel="New Department"
```

Run:

```bash
cd e2e && npx playwright test tests/departments.spec.ts --project=chromium
```

Fails:

```
Timed out waiting for getByText('Add Department')
```

**Why it breaks:** The E2E test opens a real browser, navigates to `/departments`, and looks for
a button with the text "Add Department" — just like a real user would. We changed the label to
"New Department", so Playwright can't find it and times out. The backend is untouched. The API
is fine. The database is fine. All unit, integration, and contract tests still pass. But a user
sitting at their screen can't find the button they expect. Only an E2E test — which sees the
actual rendered page — catches this.

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

| Layer            | Tests   | Speed | Needs                  | Runs            | Config file  |
|------------------|---------|-------|------------------------|-----------------|--------------|
| Unit (backend)   | 58      | ~2s   | Nothing                | Every push/PR   | ci.yml       |
| Unit (frontend)  | 5       | ~80s  | jsdom + React          | Every push/PR   | ci.yml       |
| Contract         | ~15     | ~5s   | PostgreSQL (Docker)    | Every push/PR   | ci.yml       |
| Integration      | ~85     | ~10s  | PostgreSQL (Docker)    | Every push/PR   | ci.yml       |
| E2E + Smoke      | 5 files | ~30s  | Full app + browser     | Nightly + manual| nightly.yml  |

**Local safety net:** Pre-push hook blocks you from pushing broken unit tests.
**CI safety net:** GitHub Actions catches integration/contract failures after push.
**Nightly safety net:** E2E catches regressions overnight across 3 browsers.
