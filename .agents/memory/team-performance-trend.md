---
name: Team performance quarter-over-quarter trend
description: Why/how Team Performance trending is persisted, since scores are computed live with no history
---

Team Performance KPIs (the gated Team tab) are computed **live** from Buildium/RentEngine/LeadSimple each refresh — there is no historical record of past scores. So any quarter-over-quarter trend must be **persisted as we go**, it cannot be back-computed.

**Rule:** snapshot the current quarter's standing into `team_perf_snapshots` (PK `(year, quarter)`, JSON `payload`) on every refresh, via an idempotent upsert (`ON CONFLICT(year,quarter) DO UPDATE`). The recording lives in `buildTeamPerformance` (team-aggregator.js) and runs on each `buildDashboard`.

**Why:** the live current quarter must keep updating as data changes, but once the calendar rolls into the next quarter its row is never touched again — so past quarters freeze at their final value automatically. Same pattern as `recordPropertySnapshot` (doors gained/lost). Trend therefore starts empty and accrues one bar per quarter, like the "Rent by Nth" tiles — do NOT fabricate prior quarters.

**How to apply:** if you add/rename a role or KPI in bonus-config.js, the trend series key off `role.id` / `kpi.id`, so historical rows for renamed ids will simply read null for new ids (and orphan old ids). `buildTeamTrend()` returns `{quarters[], roles:{[id]:{scorePct[],bonusTotal[],bonusMax[],kpis:{[kpiId]:{actuals[],scores[],tiers[]}}}}}`. UI (var-a.jsx) shows per-quarter score bars + per-KPI tier dots (dots only once ≥2 quarters exist).

**Caveat (known, left as-is):** quarter boundary uses server-local `new Date()` month, while snapshot dates elsewhere use UTC. Fine for display; revisit only if quarters must match a finance calendar exactly.
