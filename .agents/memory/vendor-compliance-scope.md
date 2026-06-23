---
name: Vendor compliance scope (maintenance/trade vendors)
description: How maintenance vendors are identified for the Buildium vendor-compliance & 1099 KPIs
---

Vendor compliance + 1099 KPIs should only count **maintenance/trade** vendors, not every payee (Restaurants, Gas Stations, Suppliers, Travel, Payroll, etc. are all "vendors" in Buildium).

**Identification:** use Buildium's built-in vendor **Category** field (`v.Category.Name`), NOT a custom field. In this account every trade is filed under a category whose name starts with **"Contractor"** — "Contractors - Plumbing/HVAC/Electrical/Roofing/Landscaping/Cleaning/Flooring/Pest/..." plus the singular "Contractor - RE Contractor (1099 Work)". Match case-insensitively on the `"contractor"` prefix.

**Why:** an earlier attempt assumed a "Vendor Type" custom field that was never populated, so the filter was a permanent no-op and the denominator was all ~403 active vendors (compliance % meaningless). Category is a real, populated, structured field. Scoping to Contractor* drops the denominator to ~54 real service vendors.

**How to apply:** filter active vendors (`IsActive !== false`, because Buildium `?statuses=Active` is unreliable) → keep those whose Category.Name starts with a prefix in `MAINTENANCE_CATEGORY_PREFIXES`. Fall back to all active vendors if zero match (never silently empty the metric). Note: "Contractors - Photography/Home Inspectors/Appraisers" are included — they're 1099 contractors; widen/narrow via `MAINTENANCE_CATEGORY_PREFIXES` if the client wants a tighter trades-only set.
