---
name: Dashboard period windowing (flow vs structural)
description: Which dashboard metrics honor the selected reporting period vs stay as-of-today, and why
---

The dashboard supports server-side reporting periods (currentMonth/lastMonth/currentQuarter/lastQuarter/currentYear/lastYear) via `periodToWindow(key, now)` → `{key,label,start,end}`, fed into `buildDashboard(window)`. `/api/dashboard?period=` caches one payload per period.

**Rule: metrics split into two classes, and the split must be preserved.**
- **Flow metrics** (income/gross/net, move-ins, prospects, apps submitted, showings/calls/texts, rent-processing reversals, reconciliation expected-months) are computed for the window `[start,end]`. They change per period.
- **Structural / point-in-time metrics** (occupancy, delinquency, total units/doors, vendor compliance, evictions, etc.) stay as-of-today. They are tagged so the frontend shows an "as of today" label (`meta.asOf`, `meta.window`).

**Intentionally NOT windowed even though they look like flow** — leave these structural:
- Renewals = trailing-12mo (chart title hardcoded "trailing 12 mo").
- RPU = last-complete-month.
- incomeByMonth YoY chart = full structural series for the year-over-year comparison.

**Why:** these three have their own fixed analytical windows that the client relies on; re-windowing them to the dropdown period would silently change long-standing definitions.

**How to apply:** when adding/altering a tile, decide flow vs structural first. Flow → filter to `[winStartIso, winEndIso]` and label with `winLabel`. Structural → leave as-of-today and ensure any KPI value and its drilldown rows use the SAME scope (a past bug had the showings tile value scoped to available-listings while its drilldown still listed all units — keep tile totals and drilldown rows mathematically reconcilable).
