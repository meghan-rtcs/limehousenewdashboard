// ── Bonus configuration ─────────────────────────────────────────────────────
// Source of truth for roles, their accountability KPIs, bonus caps,
// and Good/Better/Best scoring thresholds.
//
// SCORING:
//   Best (3)   = met or exceeded target        → full slot value
//   Better (2) = within 10% of target          → 2/3 slot value
//   Good (1)   = within 20% of target          → 1/3 slot value
//   Red (0)    = missed by >20%                → $0
//
// Slot value = maxBonus / number of accountability KPIs
// Quarterly payout = sum of all slot payouts

export const BONUS_ROLES = [
  {
    id: "pm",
    name: "Portfolio Manager",
    abbrev: "PM",
    maxBonus: 1000,
    kpis: [
      {
        id: "pm_occupancy",
        name: "Portfolio Occupancy Rate",
        definition: "% of occupied units",
        target: 95,
        direction: "gte",       // gte = higher is better, lte = lower is better
        format: "pct",
        sources: ["Buildium"],
        dataKey: "occupancyRate",  // key in the aggregator data
        drillKey: "kpiOccupancyRate",
      },
      {
        id: "pm_renewal",
        name: "Lease Renewal Rate",
        definition: "% of expiring leases renewed within target window",
        target: 70,
        direction: "gte",
        format: "pct",
        sources: ["Buildium", "LeadSimple"],
        dataKey: "renewalRate",
        drillKey: "lsRenewalRate",
      },
      {
        id: "pm_dom",
        name: "Days on Market",
        definition: "Weighted avg. days from listing to lease execution",
        target: 21,
        direction: "lte",
        format: "days",
        sources: ["RentEngine", "Buildium"],
        dataKey: "daysOnMarket",
        drillKey: "avgDaysOnMarket",
      },
      {
        id: "pm_delinquency",
        name: "Delinquency Rate",
        definition: "Current-month delinquency as % of rent roll (by 30th)",
        target: 3,
        direction: "lte",
        format: "pct",
        sources: ["Buildium"],
        dataKey: "delinquencyRate",
        drillKey: "kpiDelinquencyRate",
      },
    ],
  },
  {
    id: "pa",
    name: "Portfolio Assistant",
    abbrev: "PA",
    maxBonus: 750,
    kpis: [
      {
        id: "pa_showing",
        name: "Showing Completion Rate",
        definition: "% of scheduled showings completed (excl. prospect cancellations)",
        target: 95,
        direction: "gte",
        format: "pct",
        sources: ["RentEngine"],
        dataKey: "showingCompletionRate",
        drillKey: "kpiShowingCompletion",
      },
      {
        id: "pa_readiness",
        name: "Property Readiness",
        definition: "Properties ready for move-in by scheduled date",
        target: 100,
        direction: "gte",
        format: "pct",
        sources: ["LeadSimple", "Buildium"],
        dataKey: "propertyReadinessRate",
        drillKey: "lsPropertyReadiness",
      },
      {
        id: "pa_response",
        name: "Resident Response Time",
        definition: "Response to scheduling/access requests",
        target: 24,
        direction: "lte",
        format: "hours",
        sources: ["LeadSimple"],
        dataKey: "paResidentResponseHours",
        drillKey: "lsResidentResponseAPM",
      },
    ],
    // Visibility-only metrics: shown on Team Performance but never scored and
    // never part of the bonus slot math (kpis.length above stays 3, slotValue
    // stays maxBonus/3). Self-guided showing cancellations are prospect-driven,
    // not something the team controls, so it's not an accountability target.
    infoKpis: [
      {
        id: "pa_showing_sg",
        name: "Showing Completion — Self-Guided",
        definition: "% of self-guided showings completed (visibility only — not a bonus target)",
        format: "pct",
        sources: ["RentEngine"],
        dataKey: "showingCompletionRateSelfGuided",
        drillKey: "completionRateSelfGuided",
      },
    ],
  },
  {
    id: "bk",
    name: "Bookkeeper",
    abbrev: "BK",
    maxBonus: 500,
    kpis: [
      {
        id: "bk_recon",
        name: "Reconciliation Accuracy",
        definition: "Bank and credit card accounts reconciled daily without discrepancies",
        target: 100,
        direction: "gte",
        format: "pct",
        sources: ["Buildium"],
        dataKey: "reconAccuracyPct",
        drillKey: "kpiReconciliation",
      },
      {
        id: "bk_rent",
        name: "Rent Processing Accuracy",
        definition: "Rent and deposit transactions processed without errors",
        target: 100,
        direction: "gte",
        format: "pct",
        sources: ["Buildium"],
        dataKey: "rentProcessingPct",
        drillKey: "kpiRentProcessing",
      },
      {
        id: "bk_vendor",
        name: "Vendor Compliance",
        definition: "W-9 and COI documentation current for all active vendors",
        target: 100,
        direction: "gte",
        format: "pct",
        sources: ["Buildium"],
        dataKey: "vendorCompliancePct",
        drillKey: "kpiVendorCompliance",
      },
      {
        id: "bk_1099",
        name: "1099 Compliance",
        definition: "1099s prepared and distributed by end of January",
        target: 100,
        direction: "gte",
        format: "pct",
        sources: ["Buildium"],
        dataKey: "vendor1099Pct",
        drillKey: "kpi1099Compliance",
      },
    ],
  },
  {
    id: "ls",
    name: "Leasing Specialist",
    abbrev: "LS",
    maxBonus: 500,
    kpis: [
      {
        id: "ls_applicant",
        name: "Applicant Response Timeliness",
        definition: "Applicants contacted/updated after application submission",
        target: 95,
        direction: "gte",
        format: "pct",
        sources: ["LeadSimple", "RentEngine"],
        dataKey: "applicantResponseRate",
        drillKey: "lsApplicantResponse",
      },
      {
        id: "ls_processing",
        name: "Application Processing Time",
        definition: "Time from completed app to decision-ready handoff to PM",
        target: 48,
        direction: "lte",
        format: "hours",
        sources: ["LeadSimple"],
        dataKey: "appProcessingAvgHours",
        drillKey: "lsAppProcessingTime",
      },
      {
        id: "ls_renewal",
        name: "Renewal Follow-Up Timeliness",
        definition: "Renewal comms and status updates within workflow timelines",
        target: 95,
        direction: "gte",
        format: "pct",
        sources: ["LeadSimple"],
        dataKey: "renewalFollowUpRate",
        drillKey: "lsRenewalFollowUp",
      },
    ],
  },
  {
    id: "mk",
    name: "Marketing Specialist",
    abbrev: "MK",
    maxBonus: 0,  // hired, but no measurable KPIs defined yet
    kpis: [],     // no measurable KPIs yet
    placeholder: true,
    placeholderNote: "Hired \u2014 no measurable KPIs defined yet. Bonus structure to be configured once KPIs are established.",
  },
  {
    id: "aa",
    name: "Administrative Assistant",
    abbrev: "AA",
    maxBonus: 500,
    kpis: [
      {
        id: "aa_tasks",
        name: "Task Completion Rate",
        definition: "% of LeadSimple tasks completed on time",
        target: 95,
        direction: "gte",
        format: "pct",
        sources: ["LeadSimple"],
        dataKey: "aaTaskCompletionRate",
        drillKey: "lsTaskCompletion",
      },
      {
        id: "aa_workflow",
        name: "Workflow Compliance",
        definition: "Adherence to all assigned workflows",
        target: 100,
        direction: "gte",
        format: "pct",
        sources: ["LeadSimple"],
        dataKey: "aaWorkflowComplianceRate",
        drillKey: "lsWorkflowCompliance",
      },
      {
        id: "aa_leasing_response",
        name: "Leasing Response Time",
        definition: "Time to respond to leasing inquiries",
        target: 24,
        direction: "lte",
        format: "hours",
        sources: ["RentEngine", "LeadSimple"],
        dataKey: "aaLeasingResponseHours",
        drillKey: "lsResidentResponseAA",
      },
    ],
  },
];

// ── Scoring engine ──────────────────────────────────────────────────────────

export function scoreKpi(kpi, actualValue) {
  if (actualValue == null) return { score: null, label: "No data", tier: "gray" };

  const { target, direction } = kpi;

  // Calculate how far off target they are as a ratio
  let ratio;
  if (direction === "gte") {
    // Higher is better: 96 vs target 95 → ratio = 96/95 = 1.01
    ratio = target === 0 ? (actualValue > 0 ? 2 : 1) : actualValue / target;
  } else {
    // Lower is better: 18 vs target 21 → ratio = 21/18 = 1.17 (beating target)
    ratio = actualValue === 0 ? 2 : target / actualValue;
  }

  // Best: met or exceeded target (ratio >= 1.0)
  if (ratio >= 1.0) return { score: 3, label: "Best", tier: "green" };
  // Better: within 10% (ratio >= 0.9)
  if (ratio >= 0.9) return { score: 2, label: "Better", tier: "amber" };
  // Good: within 20% (ratio >= 0.8)
  if (ratio >= 0.8) return { score: 1, label: "Good", tier: "coral" };
  // Red: missed by >20%
  return { score: 0, label: "Red", tier: "red" };
}

export function calculateBonus(role, scores) {
  const kpiCount = role.kpis.length;
  if (kpiCount === 0) return { total: 0, max: role.maxBonus, slotValue: 0, slots: [] };

  const slotValue = role.maxBonus / kpiCount;

  // Exact (unrounded) payout per slot: (score/3) of the slot's value; a KPI with
  // no data pays $0. The exact sum can never exceed maxBonus (each score/3 ≤ 1).
  // Rounding each slot independently, however, can push the total $1 over the cap
  // (e.g. a 3-KPI / $500 role at a perfect score: round($166.67) × 3 = $501), so
  // we round with the largest-remainder method. This keeps payouts in whole
  // dollars while guaranteeing the slots sum exactly to the (rounded) total, and
  // therefore never blow past the role's cap.
  const exact = role.kpis.map((kpi, i) => {
    const s = scores[i];
    return s.score != null ? (s.score / 3) * slotValue : 0;
  });
  const payouts = largestRemainderRound(exact);

  let total = 0;
  const slots = role.kpis.map((kpi, i) => {
    const s = scores[i];
    total += payouts[i];
    return { kpiId: kpi.id, score: s.score, label: s.label, tier: s.tier, slotValue: Math.round(slotValue), payout: payouts[i] };
  });

  return { total, max: role.maxBonus, slotValue: Math.round(slotValue), slots };
}

// Round an array of non-negative values to whole numbers whose sum equals the
// rounded sum of the inputs. The leftover dollars are handed to the slots with
// the largest fractional remainders. Because the inputs here can never sum to
// more than the role's cap, neither can the result.
function largestRemainderRound(values) {
  const floors = values.map(v => Math.floor(v));
  const target = Math.round(values.reduce((a, b) => a + b, 0));
  let remainder = target - floors.reduce((a, b) => a + b, 0);
  const byFrac = values
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const result = floors.slice();
  for (let k = 0; k < byFrac.length && remainder > 0; k++) {
    result[byFrac[k].i] += 1;
    remainder--;
  }
  return result;
}
