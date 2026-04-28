# Limehouse Property Management Dashboard

A static React dashboard (Babel-in-browser) for Limehouse Property Management, served by a small Node/Express backend that pulls live operating data from Buildium and RentEngine.

## Architecture

- **Frontend** (`Limehouse Revamp/`)
  - `Limehouse Dashboard.html` — full multi-variant comparison view
  - `Limehouse Dashboard - A.html` — single-variant production view
  - `components/var-a.jsx`, `var-b.jsx`, `var-c.jsx`, `app.jsx`, `shared.jsx` — React components compiled with `@babel/standalone` in the browser
  - Each HTML page bootstraps by `fetch()`ing `/api/dashboard`, populating `window.LIMEHOUSE_DATA` and `window.LIMEHOUSE_DRILLDOWNS`, then injecting Babel-compiled `<script>` tags. Each compiled script is wrapped in an IIFE so top-level `const useState = …` declarations don't collide across files.
  - The header "Sync now" button POSTs to `/api/sync` and reloads.

- **Backend** (`server/`)
  - `index.js` — Express app, port 5000, serves `Limehouse Revamp/` statically and exposes:
    - `GET /api/dashboard` — full payload (`{ dashboard, drilldowns, sync }`)
    - `POST /api/sync` — forces a refresh
    - `GET /api/sync-status` — `{ fetchedAt, fetching, isStale, lastError, lastErrorAt, ttlMs }`
  - `lib/cache.js` — in-memory cache with 10-minute TTL and background refresh on demand
  - `lib/buildium.js` — Buildium v1 REST client (`x-buildium-client-id` / `x-buildium-client-secret` headers, `limit`/`offset` pagination)
  - `lib/rentengine.js` — RentEngine public v1 client (`Authorization: Bearer …`, `limit` + `page_number` pagination, max 100 per page; handles bare-array and `{data, page}` envelope responses)
  - `lib/aggregator.js` — pulls from both APIs in parallel and produces the dashboard shape consumed by the frontend

## Data Sources

| Metric | Source | Notes |
| --- | --- | --- |
| Total units, occupancy, owners | Buildium `/rentals/units`, `/leases?statuses=Active`, `/rentals/owners` | Occupied = unique `UnitId` set across active leases |
| Avg rent / door, RPU | Buildium active leases (`AccountDetails.Rent`) | |
| Total delinquent + aging buckets | Buildium `/leases/outstandingbalances` | Uses `Balance0To30Days`, `Balance31To60Days`, `Balance61To90Days`, `BalanceOver90Days` |
| Gross / net income (12 mo) | Buildium `/glaccounts` + `/generalledger/transactions` | Filters journal lines to `Type=Income` and `Type=Expense` GL accounts; sums `Journal.Lines[].Amount` per month |
| Lease type counts (fixed vs MTM) | Buildium active leases (`LeaseType`) | |
| New prospects, source breakdown | RentEngine `/prospects?created_after=&created_before=` | |
| Applications submitted | RentEngine `/rental_application_groups?created_after=&created_before=` | Returns paginated envelope |
| Units on market | RentEngine `/units` filtered by `status` | |

Metrics with no derivable source (rent-by-3rd, rent-by-10th, days on market, showings, calls, texts, evictions, renewal rate, rent-increase distribution) intentionally return `0` rather than mock values, per the project requirement that no mock data exist anywhere.

## Caching & Refresh

- `lib/cache.js` keeps the latest aggregated payload in memory. TTL is 10 minutes.
- The first request after server start triggers an initial refresh; subsequent requests serve the cached payload.
- `POST /api/sync` forces a refresh; the front-end "Sync now" button calls this and then reloads.
- A background refresh kicks off automatically on stale reads while still serving the previous payload.

## Environment / Secrets

Required (already configured):

- `BUILDIUM_CLIENT_ID`
- `BUILDIUM_CLIENT_SECRET`
- `RENTENGINE_API_TOKEN`

Postgres env vars (`DATABASE_URL`, `PG*`) are present but unused by this app.

## Workflow

`Start application` runs `node server/index.js` on port 5000, which is what the preview proxies.

## Notes

- Mock data has been removed entirely. The previous `Limehouse Revamp/data/mock-data.js` and `data/drilldowns.js` were deleted.
- The OpenAPI spec for RentEngine lives at `attached_assets/openapi_1777396695311.json` (kept as a reference).
