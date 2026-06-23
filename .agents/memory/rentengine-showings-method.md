---
name: RentEngine showings — accompanied vs self-guided not measurable
description: Why the showing-completion KPI cannot separate accompanied from self-guided showings
---

The showing-completion KPI uses RentEngine `/reporting/leasing-performance/units/{unitId}`, which returns only aggregate integers `showings_scheduled` and `showings_completed` — **no method/type dimension**.

`/showings/availability` exposes `availability.preferredShowingWindows[].showingMethodsAvailable` (enum: Accompanied / Remote Guided / Remote Guided with Gated Access / Self Guided), but this is **availability configuration** — which methods are *offered* for a time slot — NOT a record of how any actual completed showing happened. `/showings/create` only returns a `statusText`. There is no per-showing record carrying method + completion status.

**Conclusion:** you cannot compute "% of completed showings that were self-guided vs accompanied" from the public API. `showingMethodsAvailable` would at best tell you which listings *offer* self-guided as an option, which is not the same thing and would be misleading if used as a self-showing exclusion.

**Decision:** showing-completion stays scoped to available listings only; self-showing exclusion is not implemented. Revisit only if RentEngine adds a per-showing method+outcome record.
