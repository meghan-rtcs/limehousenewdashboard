---
name: Dashboard cold-start persistence
description: Why the dashboard is persisted to app_cache and served before the live rebuild on startup
---

`buildDashboard()` (aggregator.js) is **inherently slow** — it makes hundreds of live API calls every run: one RentEngine `leasing-performance` call per unit, per-lease Buildium transaction pulls (security deposits, rent processing), reconciliations per bank account, plus RentEngine prospects/units/app-groups and Buildium applicants/vendors. RentEngine has **no concurrency cap or 429 backoff**, so the per-unit calls fire all at once and get heavily rate-limited (429 storm), pushing a cold build to multiple minutes.

**Rule:** never let the first `/api/dashboard` request block on a fresh build. Persist the last fully-built payload to the `app_cache` table (`key='dashboard'`, JSON `{payload, builtAt}`) inside `refreshDashboard()`, and on startup `loadPersistedDashboard()` into memory synchronously so requests serve instantly. Run `syncAll("full")` + `refreshDashboard()` in a **non-awaited** background IIFE.

**Why:** before this, the in-memory cache started empty on every deploy/idle-wake, so the first load waited ~80s+ (worse under 429s) or got a 503. With persistence, only the very first build ever is slow; every later cold start serves the prior snapshot in <1s with correct `isStale` (cachedAt restored from `builtAt`).

**How to apply:** keep persist best-effort (try/catch) so cache I/O never breaks a build. Startup's direct `syncAll` does NOT trigger the scheduler `postSyncHook` (only scheduler `runSync`/`runLeadSimpleSync` do), so there's no double build. If first-build latency/quality matters, the real lever is adding a concurrency cap + Retry-After backoff to the RentEngine client (the 429s also drop leasing-performance metrics to null).
