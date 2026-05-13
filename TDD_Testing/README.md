# TDD_Testing

Sample client-management app used as a fixture for showcasing every testing
category. The app itself is intentionally small — a React client + Express
server with in-memory storage and full CRUD — but every layer is structured
to give tests something meaningful to assert against.

## Layout

```
TDD_Testing/
  client/                  React + Vite + TS
  server/                  Express + TS, in-memory store
  tests/
    contract/              Zod schemas + vitest (validates live API shapes)
    e2e/                   Playwright (full browser flow)
    perf/                  autocannon load test with budget
    smoke/                 plain Node fetch checks
  package.json             npm workspaces + every test:* script
```

## The six testing categories and where they live

| Category | Tool | Location | What it asserts |
|---|---|---|---|
| **Unit** | vitest | `server/src/__tests__/unit/`, `client/src/__tests__/unit/` | Pure functions in isolation: validation rules, sort/filter, formatters |
| **Integration** | vitest + supertest (server), vitest + @testing-library (client) | `*/src/__tests__/integration/` | Routes wired to store + validation; components wired to user events + state |
| **Contract** | vitest + zod | `tests/contract/` | Live API responses match the schema the client depends on |
| **E2E** | Playwright | `tests/e2e/` | Full browser flow: list → create → conditional fields → delete |
| **Performance** | autocannon | `tests/perf/` | Throughput + p99 latency against a hot endpoint, with budget |
| **Smoke** | Node `fetch` | `tests/smoke/` | Critical endpoints respond 2xx — quick post-deploy sanity |

## Setup

```bash
npm install            # installs all workspaces in one shot
npm run test:e2e:install   # one-time: Playwright Chromium browser
```

## Running the tests

| Command | What it does |
|---|---|
| `npm run test:unit` | All unit tests (server + client) |
| `npm run test:unit:server` | Server units only |
| `npm run test:unit:client` | Client units only |
| `npm run test:integration` | All integration tests (server + client) |
| `npm run test:integration:server` | Server routes via supertest |
| `npm run test:integration:client` | React components via Testing Library |
| `npm run test:contract` | Starts server, validates responses against Zod schemas |
| `npm run test:smoke` | Starts server, hits critical endpoints |
| `npm run test:perf` | Starts server, runs autocannon load test |
| `npm run test:e2e` | Starts server + client, runs Playwright |
| `npm run test:all` | Runs every category in sequence |

`test:contract`, `test:smoke`, `test:perf`, and `test:e2e` use
`start-server-and-test` to bring up the server (and client, for e2e) and
tear it down when the test exits.

## Dev

```bash
npm run dev:server    # http://localhost:4000
npm run dev:client    # http://localhost:5173, proxies /api → :4000
```

Data is in-memory and reseeded on every server restart — no database, no
files, no persistence.
