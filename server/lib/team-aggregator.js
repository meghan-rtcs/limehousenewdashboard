// ── Team Performance aggregator ──────────────────────────────────────────────
// Merges KPI values from the main aggregator (Buildium/RE) and the LS
// aggregator into the bonus-config structure, scores them, and returns
// the payload for the Team Performance tab.

import { BONUS_ROLES, scoreKpi, calculateBonus } from "./bonus-config.js";

// ── Value extraction ────────────────────────────────────────────────────────
// Maps each dataKey to a function that extracts the value from the
// dashboard and/or lsKpis objects.

function extractValues(dashboard, lsKpis) {
  // Flatten LS role KPIs into a lookup by role abbrev + kpi name
  const lsByRole = {};
  if (lsKpis?.roles) {
    for (const role of lsKpis.roles) {
      lsByRole[role.abbrev] = {};
      for (const kpi of role.kpis || []) {
        lsByRole[role.abbrev][kpi.name] = kpi;
      }
    }
  }

  // Helper to get LS KPI value by role abbrev and KPI name
  const lsVal = (abbrev, name) => lsByRole[abbrev]?.[name]?.value ?? null;

  // Build the flat value map
  return {
    // ── Portfolio Manager ──
    occupancyRate: dashboard?.occupancy?.rate?.value ?? null,
    renewalRate: lsVal("PM", "Lease Renewal Rate"),
    daysOnMarket: dashboard?.leasing?.dom?.value ?? null,
    delinquencyRate: dashboard?.healthCounts?.delinquencyPct?.value ?? null,

    // ── Portfolio Assistant ──
    showingCompletionRate: dashboard?.leasing?.showingCompletion?.value ?? null,
    propertyReadinessRate: lsVal("APM", "Property Readiness"),
    paResidentResponseHours: lsVal("APM", "Resident Response Time"),

    // ── Bookkeeper ──
    reconAccuracyPct: extractFromRoleKpis(dashboard?.roleKpis, "BC", "Reconciliation Accuracy"),
    rentProcessingPct: extractFromRoleKpis(dashboard?.roleKpis, "BC", "Rent Processing Accuracy"),
    vendorCompliancePct: extractFromRoleKpis(dashboard?.roleKpis, "BC", "Vendor Compliance"),
    vendor1099Pct: extractFromRoleKpis(dashboard?.roleKpis, "BC", "1099 Compliance"),

    // ── Leasing Specialist ──
    applicantResponseRate: lsVal("LS", "Applicant Response Timeliness"),
    appProcessingAvgHours: lsVal("LS", "Application Processing Time"),
    renewalFollowUpRate: lsVal("LS", "Renewal Follow-Up Timeliness"),

    // ── Admin Assistant ──
    aaTaskCompletionRate: lsVal("AA", "Task Completion Rate"),
    aaWorkflowComplianceRate: lsVal("AA", "Workflow Compliance"),
    aaLeasingResponseHours: lsVal("AA", "Resident Response Time"),
    aaAppAccuracyPct: null, // Requires manual audit; not auto-calculable yet
  };
}

// Extract a KPI value from the existing roleKpis structure in the dashboard
function extractFromRoleKpis(roleKpis, roleAbbrev, kpiName) {
  if (!roleKpis?.roles) return null;
  const role = roleKpis.roles.find(r => r.abbrev === roleAbbrev);
  if (!role) return null;
  const kpi = role.kpis.find(k => k.name === kpiName);
  return kpi?.value ?? null;
}

// ── Main builder ────────────────────────────────────────────────────────────
export function buildTeamPerformance(dashboard, lsKpis) {
  const values = extractValues(dashboard, lsKpis);
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  const year = now.getFullYear();

  const roles = BONUS_ROLES.map(role => {
    if (role.placeholder) {
      return {
        ...role,
        kpiResults: [],
        bonus: { total: 0, max: 0, slotValue: 0, slots: [] },
        totalScore: 0,
        maxScore: 0,
        scorePct: null,
      };
    }

    // Score each KPI
    const kpiResults = role.kpis.map(kpi => {
      const actual = values[kpi.dataKey];
      const scoring = scoreKpi(kpi, actual);
      return {
        ...kpi,
        actual,
        ...scoring,
      };
    });

    // Calculate bonus
    const scores = kpiResults.map(k => ({ score: k.score, label: k.label, tier: k.tier }));
    const bonus = calculateBonus(role, scores);

    // Summary
    const scoredKpis = kpiResults.filter(k => k.score != null);
    const totalScore = scoredKpis.reduce((sum, k) => sum + k.score, 0);
    const maxScore = scoredKpis.length * 3;

    return {
      id: role.id,
      name: role.name,
      abbrev: role.abbrev,
      maxBonus: role.maxBonus,
      kpiResults,
      bonus,
      totalScore,
      maxScore,
      scorePct: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : null,
    };
  });

  return {
    quarter: `Q${quarter}`,
    year,
    quarterLabel: `Q${quarter} ${year}`,
    asOf: now.toISOString().slice(0, 10),
    roles,
  };
}
