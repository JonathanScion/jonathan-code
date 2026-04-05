# HospitalManager Testing Strategy

Comprehensive test suite covering unit, integration, contract, E2E, and smoke tests with CI/CD automation.

## Test Results (verified green)

| Layer | Tests | Status |
|-------|-------|--------|
| Backend Unit | **58 tests** (4 files) | All passing |
| Frontend Unit/Component | **35 tests** (6 files) | All passing |
| Backend Integration | ~85 tests (9 files) | Requires test DB |
| Backend Contract | ~15 tests (1 file) | Requires test DB |
| E2E (Playwright) | 5 spec files | Requires running app |

---

## Tools

| Layer | Tool | Why |
|-------|------|-----|
| Backend unit + integration | Vitest + Supertest | Native TS, faster than Jest |
| Frontend unit/component | Vitest + React Testing Library + MSW | Reuses Vite config, MSW mocks at network level |
| Contract | Zod response schemas | Zod already used in backend; lightweight |
| E2E | Playwright | Multi-browser, fast, great TS support |
| Test DB | Docker PostgreSQL | Exact prod parity |

---

## Directory Layout

```
HospitalManager/
├── backend/
│   ├── src/
│   │   ├── app.ts                          # Express app (extracted for Supertest)
│   │   ├── index.ts                        # Just app.listen()
│   │   └── __tests__/
│   │       ├── unit/
│   │       │   ├── pagination.test.ts      # 13 tests
│   │       │   ├── errorHandler.test.ts    # 9 tests
│   │       │   ├── validate.test.ts        # 3 tests
│   │       │   └── schemas.test.ts         # 33 tests
│   │       ├── integration/
│   │       │   ├── setup/
│   │       │   │   ├── global-setup.ts     # Runs migrations on test DB
│   │       │   │   ├── test-db.ts          # PrismaClient + table cleanup
│   │       │   │   ├── test-app.ts         # Supertest instance
│   │       │   │   └── fixtures.ts         # Data factories
│   │       │   ├── departments.test.ts
│   │       │   ├── rooms.test.ts
│   │       │   ├── medications.test.ts
│   │       │   ├── patients.test.ts
│   │       │   ├── appointments.test.ts
│   │       │   ├── admissions.test.ts
│   │       │   ├── visits.test.ts
│   │       │   ├── bills.test.ts
│   │       │   └── dashboard.test.ts
│   │       └── contract/
│   │           ├── response-schemas.ts     # Zod schemas mirroring frontend types
│   │           └── api-contracts.test.ts
│   ├── vitest.unit.config.ts
│   ├── vitest.integration.config.ts
│   └── vitest.contract.config.ts
├── frontend/
│   ├── vitest.config.ts
│   ├── src/
│   │   ├── __mocks__/
│   │   │   ├── handlers.ts                # MSW request handlers
│   │   │   └── server.ts                  # MSW server setup
│   │   └── __tests__/
│   │       ├── setup.ts                   # Test setup (jest-dom, MSW)
│   │       ├── test-utils.tsx             # renderWithProviders helper
│   │       ├── unit/hooks/
│   │       │   └── useCrud.test.tsx       # 5 tests
│   │       ├── components/
│   │       │   ├── StatusChip.test.tsx     # 5 tests
│   │       │   ├── FormDialog.test.tsx     # 8 tests
│   │       │   └── DataTable.test.tsx      # 6 tests
│   │       └── pages/
│   │           ├── DashboardPage.test.tsx  # 7 tests
│   │           └── DepartmentsPage.test.tsx # 5 tests (with MSW)
├── e2e/
│   ├── playwright.config.ts
│   └── tests/
│       ├── smoke.spec.ts                  # All 12 pages load without errors
│       ├── departments.spec.ts            # CRUD in browser
│       ├── appointment-workflow.spec.ts
│       ├── patient-workflow.spec.ts
│       └── billing-workflow.spec.ts
├── docker-compose.test.yml
└── .github/workflows/
    ├── ci.yml                             # Push/PR: typecheck + unit + contract + integration
    └── nightly.yml                        # Cron: E2E multi-browser matrix
```

---

## npm Scripts

### Root `package.json`
```
test:unit         Backend + frontend unit tests
test:integration  Backend integration tests (requires test DB)
test:contract     Backend contract tests (requires test DB)
test:e2e          Playwright E2E tests
test:smoke        Backend smoke tests
test:all          Everything
test:db:up        Start Docker test PostgreSQL
test:db:down      Stop Docker test PostgreSQL
test:db:migrate   Run Prisma migrations on test DB
```

### Backend `package.json`
```
test:unit         vitest run --config vitest.unit.config.ts
test:integration  vitest run --config vitest.integration.config.ts
test:contract     vitest run --config vitest.contract.config.ts
test:unit:watch   vitest --config vitest.unit.config.ts
test:coverage     vitest run --config vitest.unit.config.ts --coverage
```

### Frontend `package.json`
```
test              vitest run --config vitest.config.ts
test:watch        vitest --config vitest.config.ts
test:coverage     vitest run --config vitest.config.ts --coverage
```

---

## Running Tests Locally

### Unit tests (no dependencies needed)
```bash
cd backend && npm run test:unit      # 58 tests, ~300ms
cd frontend && npm test              # 35 tests, ~90s (jsdom startup)
```

### Integration + contract tests (need PostgreSQL)
```bash
# Option 1: Docker
npm run test:db:up
npm run test:db:migrate
npm run test:integration
npm run test:contract
npm run test:db:down

# Option 2: Local PostgreSQL
export TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/hospital_test"
cd backend && npx prisma db push --force-reset
npm run test:integration
```

### E2E tests (need running app + seeded DB)
```bash
cd e2e && npm install
npx playwright install
npm run dev            # Start both servers (in another terminal)
npm run test:e2e       # Runs against localhost:5173
```

---

## CI/CD: What Runs When

| Trigger | Tests | Estimated Time |
|---------|-------|----------------|
| Every push | Typecheck + Unit + Contract | ~1-2 min |
| Every PR | Above + Integration | ~3-5 min |
| Nightly (3am CST) | Full suite + E2E (Chromium, Firefox, WebKit) | ~10-15 min |
| Manual (`workflow_dispatch`) | Same as nightly | ~10-15 min |

---

## Test Coverage Details

### Backend Unit Tests (58 tests)

**pagination.test.ts** (13 tests)
- `getPagination` defaults, parsing, clamping (min/max), NaN handling
- `paginatedResponse` metadata, totalPages math, zero/boundary cases

**errorHandler.test.ts** (9 tests)
- `AppError` with custom status codes
- `ZodError` formatting with field paths
- Prisma `P2002` (unique), `P2025` (not found), `P2003` (FK), unknown codes
- Generic error → 500

**validate.test.ts** (3 tests)
- Valid data passes through, unknown fields stripped, invalid data throws

**schemas.test.ts** (33 tests)
- Department: required name, optional fields, null handling, length limits
- Room: valid types enum, floor range (0-50), all room types
- Medication: dosage form enum, price validation, zero price
- Appointment: duration range (5-480), type enum, positive IDs
- Patient: date coercion, gender enum, blood type enum, email format
- Bill: date formats (date/datetime), positive patientId
- BillLineItem: category enum, positive quantity

### Backend Integration Tests (~85 tests)

**departments.test.ts** — CRUD + search + pagination + unique constraint (409)
**rooms.test.ts** — CRUD + `_count.beds` + beds include + unique number
**medications.test.ts** — CRUD + search + dosage form validation
**patients.test.ts** — CRUD + OR search (firstName/lastName) + deep includes + cascade delete
**appointments.test.ts** — CRUD + full status chain (SCHEDULED→CONFIRMED→IN_PROGRESS→COMPLETED) + invalid transitions + terminal states
**admissions.test.ts** — CRUD + DISCHARGED sets dischargeDate + bed release on discharge
**visits.test.ts** — CRUD + deep includes (diagnoses, labOrders, prescriptions with items)
**bills.test.ts** — Bills CRUD + status transitions + line items with auto-recalculation
**dashboard.test.ts** — All 5 aggregation stats verified

### Frontend Tests (35 tests)

**useCrud.test.tsx** — Hook returns all functions, useList fetches, param filtering, useGet disabled/enabled
**StatusChip.test.tsx** — Label rendering, underscore→space, size prop, unknown status fallback
**FormDialog.test.tsx** — Open/close/submit, Cancel/X button, loading state, custom label
**DataTable.test.tsx** — Column headers, row data, search input conditional rendering
**DashboardPage.test.tsx** — Loading spinner, all 5 stat cards, values from MSW mock
**DepartmentsPage.test.tsx** — Page header, Add button, data from MSW, create dialog, search

### E2E Tests (5 specs, ~30 tests)

**smoke.spec.ts** — All 12 pages load without console errors
**departments.spec.ts** — List, create dialog, form fill + save, search, cancel
**appointment-workflow.spec.ts** — Page load, create dialog, form fields
**patient-workflow.spec.ts** — Page load, create dialog, name fields, search
**billing-workflow.spec.ts** — Page load, create dialog, dashboard integration
