import { buildium } from "./buildium.js";
import { rentengine } from "./rentengine.js";
import {
  recordSnapshot,
  rentCollectedByDay,
  rentCollectedSeries,
} from "./history.js";

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthKey(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function last12Months(now = new Date()) {
  const out = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({
      key: monthKey(d),
      label: MONTH_LABELS[d.getUTCMonth()],
      year: d.getUTCFullYear(),
      from: d.toISOString(),
      to: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59)).toISOString(),
    });
  }
  return out;
}

function safe(promise, fallback) {
  return promise.catch((err) => {
    console.warn("[aggregator] non-fatal:", err.message);
    return fallback;
  });
}

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function sum(arr, getter = (x) => x) {
  return arr.reduce((acc, x) => acc + (Number(getter(x)) || 0), 0);
}

function buildKpi(value, prevYear = 0, opts = {}) {
  return { value: value ?? 0, prevYear: prevYear ?? 0, ...opts };
}

export async function buildDashboard() {
  const now = new Date();
  const months = last12Months(now);
  const yearAgoFrom = months[0].from;

  let [
    bdUnits,
    bdProperties,
    bdActiveLeases,
    bdAllLeases,
    bdOutstanding,
    bdOwners,
    bdGLAccounts,
    bdTenants,
    bdRenewals,
    reUnits,
    reProspects,
    reAppGroups,
  ] = await Promise.all([
    safe(buildium.listUnits(), []),
    safe(buildium.listProperties(), []),
    safe(buildium.listLeases(["Active"]), []),
    safe(buildium.listAllLeases(), []),
    safe(buildium.listOutstandingBalances(), []),
    safe(buildium.listOwners(), []),
    safe(buildium.listGLAccounts(), []),
    safe(buildium.listTenants(), []),
    safe(buildium.listLeaseRenewals(), []),
    safe(rentengine.listUnits(), []),
    safe(rentengine.listProspects(yearAgoFrom, now.toISOString()), []),
    safe(
      rentengine.listApplicationGroups({
        createdAfter: yearAgoFrom,
        createdBefore: now.toISOString(),
      }),
      []
    ),
  ]);

  // Normalized identity per tenant — emails are reused across consecutive
  // Buildium tenant records when the same person renews under a new lease.
  const tenantKey = new Map();
  for (const t of bdTenants) {
    const email = (t.Email || t.AlternateEmail || "").trim().toLowerCase();
    const name = `${(t.FirstName || "").trim()} ${(t.LastName || "").trim()}`
      .trim()
      .toLowerCase();
    const key = email || (name && t.DateOfBirth ? `${name}|${t.DateOfBirth}` : name);
    if (key) tenantKey.set(t.Id, key);
  }

  // GL transactions for the trailing 12 months, filtered to income+expense accounts
  const incomeAccountIds = bdGLAccounts.filter((a) => a.Type === "Income").map((a) => a.Id);
  const expenseAccountIds = bdGLAccounts.filter((a) => a.Type === "Expense").map((a) => a.Id);
  const fmtDate = (iso) => iso.slice(0, 10);
  const bdGLTxns = bdGLAccounts.length
    ? await safe(
        buildium.listGLTransactions({
          startdate: fmtDate(yearAgoFrom),
          enddate: fmtDate(now.toISOString()),
          glaccountids: [...incomeAccountIds, ...expenseAccountIds],
        }),
        []
      )
    : [];

  // ── meta ──────────────────────────────────────────────────────────────────
  // Restrict the entire portfolio to active (still-managed) properties.
  // Buildium keeps off-boarded properties + their units + their stale leases
  // in the API responses with `Property.IsActive=false`; counting them would
  // inflate vacancy and skew lease/financial metrics.
  const activePropertyIds = new Set(
    bdProperties.filter((p) => p.IsActive !== false).map((p) => p.Id)
  );
  const inActiveProp = (x) => activePropertyIds.has(x.PropertyId);
  bdUnits = bdUnits.filter(inActiveProp);
  const activeUnitIds = new Set(bdUnits.map((u) => u.Id));
  const inActiveUnit = (l) => activeUnitIds.has(l.UnitId ?? l.Unit?.Id);
  bdActiveLeases = bdActiveLeases.filter(inActiveUnit);
  bdAllLeases = bdAllLeases.filter(inActiveUnit);
  bdRenewals = bdRenewals.filter(
    (r) => !r.UnitId || activeUnitIds.has(r.UnitId)
  );
  const totalUnits = bdUnits.length;
  const activeLeases = bdActiveLeases.length;
  const meta = {
    syncedAt: now.toISOString().replace("T", " ").slice(0, 16),
    rentEngineUnits: reUnits.length,
    buildiumUnits: totalUnits,
    activeLeases,
  };

  // ── occupancy ─────────────────────────────────────────────────────────────
  const occupiedUnitIds = new Set(
    bdActiveLeases.map((l) => l.UnitId ?? l.Unit?.Id).filter(Boolean)
  );
  const occupiedUnits = Math.min(occupiedUnitIds.size, totalUnits);
  const vacantUnits = Math.max(totalUnits - occupiedUnits, 0);

  // ── vacant-rented: units not currently occupied with a Future lease starting later
  const todayIso = now.toISOString().slice(0, 10);
  const futureLeases = bdAllLeases.filter(
    (l) => l.LeaseStatus === "Future" && l.LeaseFromDate && l.LeaseFromDate > todayIso
  );
  const vacantRentedUnitIds = new Set(
    futureLeases
      .map((l) => l.UnitId ?? l.Unit?.Id)
      .filter((id) => id && !occupiedUnitIds.has(id))
  );
  const vacantRentedCount = vacantRentedUnitIds.size;
  const vacantNotRentedCount = Math.max(vacantUnits - vacantRentedCount, 0);

  // ── avg days vacant: for each currently-vacant unit, days since the most recent
  // past lease's MoveOutData (or LeaseToDate) for that unit.
  const pastLeasesByUnit = new Map();
  for (const l of bdAllLeases) {
    if (l.LeaseStatus !== "Past") continue;
    const uid = l.UnitId ?? l.Unit?.Id;
    if (!uid) continue;
    const moveOut = (l.MoveOutData || [])
      .map((m) => m.MoveOutDate)
      .filter(Boolean)
      .sort()
      .pop();
    const endDate = moveOut || l.LeaseToDate;
    if (!endDate) continue;
    const cur = pastLeasesByUnit.get(uid);
    if (!cur || endDate > cur) pastLeasesByUnit.set(uid, endDate);
  }
  const vacantDays = [];
  for (const u of bdUnits) {
    if (occupiedUnitIds.has(u.Id)) continue;
    const last = pastLeasesByUnit.get(u.Id);
    if (!last) continue;
    const lastTs = new Date(last).getTime();
    if (!Number.isFinite(lastTs)) continue;
    const days = Math.max(
      0,
      Math.floor((now.getTime() - lastTs) / (1000 * 60 * 60 * 24))
    );
    vacantDays.push(days);
  }
  const avgDaysVacant = vacantDays.length
    ? Math.round(vacantDays.reduce((a, b) => a + b, 0) / vacantDays.length)
    : 0;

  // ── owners gained / doors lost from ManagementAgreement dates
  const yearAgoIso = yearAgoFrom.slice(0, 10);
  const ownersGainedList = bdOwners.filter(
    (o) => o.ManagementAgreementStartDate && o.ManagementAgreementStartDate >= yearAgoIso
  );
  const ownersLostList = bdOwners.filter(
    (o) => o.ManagementAgreementEndDate && o.ManagementAgreementEndDate >= yearAgoIso
  );
  // doors lost = number of units belonging to properties of owners who ended in the window
  const lostPropertyIds = new Set(
    ownersLostList.flatMap((o) => o.PropertyIds || [])
  );
  const doorsLost = bdUnits.filter((u) => lostPropertyIds.has(u.PropertyId)).length;

  // doors added (units created in last 12 months, by created date if available)
  const unitsWithCreated = bdUnits.filter((u) => u.CreatedDateTime);
  const doorsAdded = unitsWithCreated.length
    ? unitsWithCreated.filter(
        (u) => new Date(u.CreatedDateTime) >= new Date(yearAgoFrom)
      ).length
    : 0;
  const netDoors = doorsAdded - doorsLost;

  const occupancy = {
    rate: buildKpi(pct(occupiedUnits, totalUnits), 0, { unit: "%" }),
    occupiedUnits,
    totalUnits,
    vacantNotRented: buildKpi(vacantNotRentedCount, 0, { invertDelta: true }),
    vacantRented: buildKpi(vacantRentedCount, 0),
    avgDaysVacant: buildKpi(avgDaysVacant, 0, { invertDelta: true }),
    doorsAdded: buildKpi(doorsAdded, 0),
    doorsLost: buildKpi(doorsLost, 0, { invertDelta: true }),
    netDoors: buildKpi(netDoors, 0),
    ownersTotal: buildKpi(bdOwners.length, 0),
    ownersGained: buildKpi(ownersGainedList.length, 0),
  };

  // ── leases breakdown ──────────────────────────────────────────────────────
  const fixedLeases = bdActiveLeases.filter(
    (l) => (l.LeaseType || "").toLowerCase().includes("fixed")
  ).length;
  const mtmLeases = bdActiveLeases.filter((l) => {
    const t = (l.LeaseType || "").toLowerCase();
    return t.includes("month") || t === "atwill";
  }).length;

  // ── financials ────────────────────────────────────────────────────────────
  const totalDelinquent = sum(bdOutstanding, (b) => b.TotalBalance);
  const delinquentCount = bdOutstanding.filter((b) => Number(b.TotalBalance) > 0).length;

  const monthlyRent = bdActiveLeases
    .map((l) => Number(l.AccountDetails?.Rent ?? l.RentAmount ?? 0))
    .filter((v) => v > 0);
  const avgRentPerDoor = monthlyRent.length
    ? Math.round(monthlyRent.reduce((a, b) => a + b, 0) / monthlyRent.length)
    : 0;
  const totalRentPotential = monthlyRent.reduce((a, b) => a + b, 0);

  // Per-month income from GL transactions
  const incomeAcctSet = new Set(incomeAccountIds);
  const expenseAcctSet = new Set(expenseAccountIds);
  const incomeByMonth = months.map((m) => ({ month: m.label, gross: 0, net: 0, _expense: 0 }));
  for (const t of bdGLTxns) {
    const dateStr = t.Date || t.TransactionDate || t.date;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    const idx = months.findIndex((m) => m.key === monthKey(d));
    if (idx < 0) continue;
    const lines = Array.isArray(t.Journal?.Lines)
      ? t.Journal.Lines
      : Array.isArray(t.Lines)
        ? t.Lines
        : [];
    for (const line of lines) {
      const acctId =
        line.GLAccount?.Id ?? line.GLAccountId ?? line.GlAccountId ?? line.AccountId;
      const amount = Number(line.Amount ?? 0);
      if (incomeAcctSet.has(acctId)) {
        incomeByMonth[idx].gross += amount;
      } else if (expenseAcctSet.has(acctId)) {
        incomeByMonth[idx]._expense += amount;
      }
    }
  }
  for (const m of incomeByMonth) {
    m.gross = Math.round(m.gross / 1000);
    m.net = Math.round(m.gross - m._expense / 1000);
    delete m._expense;
  }
  const grossIncomeTotal = sum(incomeByMonth, (m) => m.gross);
  const netIncomeTotal = sum(incomeByMonth, (m) => m.net);

  // ── rent collection by Nth — derived from sync-history snapshots
  const paidActiveLeases = activeLeases - delinquentCount;
  recordSnapshot({
    ts: now.toISOString(),
    totalLeases: activeLeases,
    paidLeases: Math.max(paidActiveLeases, 0),
    delinquentLeases: delinquentCount,
    delinquentTotal: Math.round(totalDelinquent),
  });
  const by3rd = rentCollectedByDay(3, 6);
  const by10th = rentCollectedByDay(10, 6);
  const by3rdSeries = rentCollectedSeries(3, 12);
  const by10thSeries = rentCollectedSeries(10, 12);

  const financials = {
    rentCollectedBy3rd: buildKpi(by3rd.value, 0, { unit: "%" }),
    rentCollectedBy10th: buildKpi(by10th.value, 0, { unit: "%" }),
    avgRentPerDoor: buildKpi(avgRentPerDoor, 0, { unit: "$" }),
    rpu: buildKpi(
      totalUnits ? Math.round(totalRentPotential / totalUnits) : 0,
      0,
      { unit: "$" }
    ),
    grossIncome: buildKpi(grossIncomeTotal, 0, { unit: "$k" }),
    netIncome: buildKpi(netIncomeTotal, 0, { unit: "$k" }),
    delinquent: buildKpi(Math.round(totalDelinquent), 0, { unit: "$", invertDelta: true }),
    delinquentCount: buildKpi(delinquentCount, 0, { invertDelta: true }),
  };

  // ── leasing ───────────────────────────────────────────────────────────────
  const appsSubmitted = reAppGroups.length;
  const moveins = reAppGroups.filter((g) =>
    /move|approved/i.test(g.status || "")
  ).length;

  // Renewals: use Buildium's /leases/renewals endpoint directly. Each renewal
  // record is a renewal lease with its own LeaseFromDate. Limehouse handles
  // renewals via Buildium's renewal-offer workflow rather than by creating a
  // brand-new lease record on the same unit, so consecutive-lease heuristics
  // miss them entirely.
  const renewalsRecent = bdRenewals.filter(
    (r) => r.LeaseFromDate && r.LeaseFromDate >= yearAgoIso
  );
  const renewalsInWindow = renewalsRecent.length;

  // Denominator: total "lease-end events" in the trailing 12 months — past
  // leases whose LeaseToDate fell in the window plus renewals (which prevented
  // an end). This gives renewal rate = renewed / (renewed + churned).
  const churnedInWindow = bdAllLeases.filter(
    (l) =>
      l.LeaseStatus === "Past" &&
      l.LeaseToDate &&
      l.LeaseToDate >= yearAgoIso &&
      l.LeaseToDate <= todayIso
  ).length;
  const renewalDenominator = renewalsInWindow + churnedInWindow;
  const renewalRate = renewalDenominator
    ? Math.round((renewalsInWindow / renewalDenominator) * 1000) / 10
    : 0;

  // Renewals per month for sparkline / chart
  const renewalsByMonthCount = months.map(() => 0);
  for (const r of renewalsRecent) {
    const idx = months.findIndex(
      (m) => m.key === monthKey(new Date(r.LeaseFromDate))
    );
    if (idx >= 0) renewalsByMonthCount[idx] += 1;
  }
  const renewalDetails = renewalsRecent.map((r) => ({ curr: r }));

  const evictionsPendingCount = bdActiveLeases.filter((l) => l.IsEvictionPending).length;

  const leasing = {
    renewalRate: buildKpi(renewalRate, 0, { unit: "%" }),
    renewalsCount: buildKpi(renewalsInWindow, 0),
    mtmLeases: buildKpi(mtmLeases, 0, { invertDelta: true }),
    fixedLeases: buildKpi(fixedLeases, 0),
    appsSubmitted: buildKpi(appsSubmitted, 0),
    moveins: buildKpi(moveins, 0),
    appsPerMovein: buildKpi(moveins ? +(appsSubmitted / moveins).toFixed(1) : 0, 0),
    evictionsPending: buildKpi(evictionsPendingCount, 0, { invertDelta: true }),
  };

  // ── marketing ─────────────────────────────────────────────────────────────
  const newProspects = reProspects.length;
  const sourceCounts = {};
  for (const p of reProspects) {
    const src = p.source || "Other";
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  }
  const SOURCE_COLORS = {
    Zillow: "#3d8c1f",
    "Apartments.com": "#2471a3",
    Trulia: "#7d3c98",
    Hotpads: "#7d3c98",
    Direct: "#d68910",
    Referrals: "#1c2119",
    Other: "#aab5a3",
  };
  const prospectsBySource = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({
      label,
      value,
      color: SOURCE_COLORS[label] || "#aab5a3",
    }));

  // Marketing listings → units on market (RentEngine units flagged as available/listed).
  const reAvailable = reUnits.filter(
    (u) => !u.is_occupied && /avail|list|market/i.test(u.status || "")
  );
  const unitsOnMarket = reAvailable.length;

  // Days on market: for currently-available RentEngine units, days since created_at
  // (RentEngine creates the unit record when it goes onto market).
  const dom = reAvailable
    .map((u) => {
      const start = u.created_at ? new Date(u.created_at) : null;
      if (!start || Number.isNaN(start.getTime())) return null;
      return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
    })
    .filter((v) => v !== null);
  const avgDaysOnMarket = dom.length
    ? Math.round(dom.reduce((a, b) => a + b, 0) / dom.length)
    : 0;
  const sortedDom = [...dom].sort((a, b) => a - b);
  const medianDaysOnMarket = sortedDom.length
    ? sortedDom[Math.floor(sortedDom.length / 2)]
    : 0;

  const marketing = {
    unitsOnMarket: buildKpi(unitsOnMarket, 0, { invertDelta: true }),
    avgDaysOnMarket: buildKpi(avgDaysOnMarket, 0, { invertDelta: true }),
    medianDaysOnMarket: buildKpi(medianDaysOnMarket, 0, { invertDelta: true }),
    newProspects: buildKpi(newProspects, 0),
    showingsCompleted: buildKpi(0, 0),
    totalCalls: buildKpi(0, 0),
    totalTexts: buildKpi(0, 0),
    completionRate: buildKpi(0, 0, { unit: "%" }),
  };

  // ── sparklines (12 mo) ────────────────────────────────────────────────────
  const prospectsByMonth = months.map((m) => 0);
  for (const p of reProspects) {
    const d = new Date(p.created_at);
    const idx = months.findIndex((m) => m.key === monthKey(d));
    if (idx >= 0) prospectsByMonth[idx] += 1;
  }
  const flat = (v) => Array(12).fill(v);
  const spark = {
    occupancy: flat(occupancy.rate.value),
    rentCollected3rd: by3rdSeries.map((s) => s.pct),
    rentCollected10th: by10thSeries.map((s) => s.pct),
    doorsAdded: flat(0),
    doorsLost: flat(0),
    renewalRate: renewalsByMonthCount,
    avgRent: flat(avgRentPerDoor),
    rpu: flat(financials.rpu.value),
    grossIncome: incomeByMonth.map((m) => m.gross),
    netIncome: incomeByMonth.map((m) => m.net),
    daysOnMarket: flat(avgDaysOnMarket),
    delinquent: flat(financials.delinquent.value),
    prospects: prospectsByMonth,
    showings: flat(0),
  };

  // ── chart datasets ────────────────────────────────────────────────────────
  const rentCollectionByMonth = months.map((m, i) => ({
    month: m.label,
    by3rd: by3rdSeries[i]?.pct || 0,
    by10th: by10thSeries[i]?.pct || 0,
  }));
  const doorsMonthly = months.map((m) => ({ month: m.label, added: 0, lost: 0 }));
  const renewalsByMonth = months.map((m, i) => ({
    month: m.label,
    count: renewalsByMonthCount[i] || 0,
  }));
  const incomeMonthly = incomeByMonth;
  const occupancyTrend = months.map((m) => ({ month: m.label, rate: occupancy.rate.value }));
  const delinquentTrend = months.map((m) => ({
    month: m.label,
    amount: +(financials.delinquent.value / 1000).toFixed(1),
  }));

  // ── distributions ─────────────────────────────────────────────────────────
  const agingBuckets = [
    { label: "0–30", amount: 0, color: "#d68910" },
    { label: "31–60", amount: 0, color: "#3d8c1f" },
    { label: "61–90", amount: 0, color: "#c0392b" },
    { label: "90+", amount: 0, color: "#8b1f15" },
  ];
  for (const b of bdOutstanding) {
    agingBuckets[0].amount += Number(b.Balance0To30Days ?? 0);
    agingBuckets[1].amount += Number(b.Balance31To60Days ?? 0);
    agingBuckets[2].amount += Number(b.Balance61To90Days ?? 0);
    agingBuckets[3].amount += Number(b.BalanceOver90Days ?? 0);
  }
  agingBuckets.forEach((b) => (b.amount = Math.round(b.amount)));

  const healthCounts = {
    Healthy: occupiedUnits,
    "At-risk": delinquentCount,
    Waitlist: 0,
    "On Hold": 0,
    "Off-Market": vacantUnits,
  };

  const marketingFunnel = [
    { label: "Prospects (inquiries)", value: newProspects },
    { label: "Showings scheduled", value: 0 },
    { label: "Showings completed", value: 0 },
    { label: "Applications submitted", value: appsSubmitted },
    { label: "Move-ins", value: moveins },
  ];

  const rentIncreaseDistribution = [
    { label: "0–1%", value: 0 },
    { label: "1–2%", value: 0 },
    { label: "2–3%", value: 0 },
    { label: "3–4%", value: 0 },
    { label: "4–5%", value: 0 },
    { label: "5%+", value: 0 },
  ];

  // ── assemble dashboard ────────────────────────────────────────────────────
  const dashboard = {
    meta,
    spark,
    financials,
    occupancy,
    leasing,
    marketing,
    rentCollectionByMonth,
    doorsMonthly,
    renewalsByMonth,
    healthCounts,
    agingBuckets,
    prospectsBySource,
    marketingFunnel,
    delinquentTrend,
    incomeMonthly,
    occupancyTrend,
    rentIncreaseDistribution,
    rentCollectionDetail: [],
    doorsAddedDetail: [],
  };

  // ── drilldowns (real, where derivable) ────────────────────────────────────
  const drilldowns = {
    delinquent: {
      title: "Delinquent leases",
      cols: ["Lease ID", "Property", "Unit", "Balance"],
      rows: bdOutstanding
        .filter((b) => Number(b.TotalBalance) > 0)
        .slice(0, 200)
        .map((b) => [
          String(b.LeaseId || b.Id || ""),
          String(b.PropertyName || b.Property?.Name || "—"),
          String(b.UnitNumber || b.Unit?.UnitNumber || "—"),
          `$${Math.round(Number(b.TotalBalance)).toLocaleString()}`,
        ]),
      summary: `${delinquentCount} leases · $${Math.round(totalDelinquent).toLocaleString()} owed`,
    },
    newProspects: {
      title: "New prospects (last 12 months)",
      cols: ["Name", "Source", "Status", "Created"],
      rows: reProspects
        .slice(-200)
        .reverse()
        .map((p) => [
          p.name || "—",
          p.source || "—",
          p.status || "—",
          (p.created_at || "").slice(0, 10),
        ]),
      summary: `${newProspects} prospects · ${prospectsBySource.length} sources`,
    },
    appsSubmitted: {
      title: "Applications submitted",
      cols: ["Group ID", "Status", "Unit", "Created"],
      rows: reAppGroups
        .slice(-200)
        .reverse()
        .map((g) => [
          String(g.id || g.group_id || ""),
          g.status || "—",
          String(g.unit_id || g.unit?.id || "—"),
          (g.created_at || "").slice(0, 10),
        ]),
      summary: `${appsSubmitted} applications`,
    },
    renewalsCount: {
      title: "Lease renewals (last 12 months)",
      cols: ["Lease ID", "Status", "Renewed from", "Renewed to", "Rent"],
      rows: renewalsRecent.slice(0, 200).map((r) => [
        String(r.Id || "—"),
        r.LeaseStatus || "—",
        r.LeaseFromDate || "—",
        r.LeaseToDate || "—",
        r.Rent != null ? `$${Math.round(r.Rent)}` : "—",
      ]),
      summary: `${renewalsInWindow} renewals · ${renewalRate}% rate (${churnedInWindow} leases ended)`,
    },
    evictionsPending: {
      title: "Evictions pending",
      cols: ["Lease ID", "Unit", "From", "To"],
      rows: bdActiveLeases
        .filter((l) => l.IsEvictionPending)
        .slice(0, 200)
        .map((l) => [
          String(l.Id),
          String(l.UnitNumber || l.UnitId || "—"),
          l.LeaseFromDate || "—",
          l.LeaseToDate || "—",
        ]),
      summary: `${evictionsPendingCount} active leases`,
    },
    ownersGained: {
      title: "Owners gained (last 12 months)",
      cols: ["Owner", "Start date", "Properties"],
      rows: ownersGainedList.slice(0, 200).map((o) => [
        o.CompanyName || `${o.FirstName || ""} ${o.LastName || ""}`.trim() || "—",
        o.ManagementAgreementStartDate || "—",
        String((o.PropertyIds || []).length),
      ]),
      summary: `${ownersGainedList.length} owners`,
    },
    avgDaysVacant: (() => {
      const vacantUnitsList = bdUnits.filter((u) => !occupiedUnitIds.has(u.Id));
      const withHistory = vacantUnitsList.filter((u) => pastLeasesByUnit.has(u.Id));
      const noHistory = vacantUnitsList.filter((u) => !pastLeasesByUnit.has(u.Id));
      const rows = [
        ...withHistory.map((u) => {
          const since = pastLeasesByUnit.get(u.Id);
          const days = Math.floor((now - new Date(since)) / (1000 * 60 * 60 * 24));
          return [
            String(u.UnitNumber || u.Id),
            String(u.BuildingName || propName(u.PropertyId)),
            since,
            String(days),
          ];
        }),
        ...noHistory.map((u) => [
          String(u.UnitNumber || u.Id),
          String(u.BuildingName || propName(u.PropertyId)),
          "no prior lease in Buildium",
          "—",
        ]),
      ];
      const summary =
        withHistory.length === 0
          ? `Avg = 0 because none of the ${vacantUnitsList.length} currently-vacant units have a prior lease in Buildium (likely never leased through this account)`
          : `${withHistory.length} of ${vacantUnitsList.length} vacant units have lease history · avg ${avgDaysVacant} days for those`;
      return {
        title: "Currently vacant units",
        cols: ["Unit", "Property", "Vacant since", "Days"],
        rows: rows.slice(0, 500),
        summary,
      };
    })(),
    avgDaysOnMarket: {
      title: "Units currently on market",
      cols: ["Unit ID", "Status", "Listed since", "Days"],
      rows: reAvailable.slice(0, 200).map((u) => {
        const days = u.created_at
          ? Math.floor((now - new Date(u.created_at)) / (1000 * 60 * 60 * 24))
          : 0;
        return [
          String(u.id),
          u.status || "—",
          (u.created_at || "").slice(0, 10),
          String(days),
        ];
      }),
      summary: `${unitsOnMarket} listed · avg ${avgDaysOnMarket} days · median ${medianDaysOnMarket}`,
    },
    doorsLost: {
      title: "Doors lost (owners ended in last 12 months)",
      cols: ["Owner", "End date", "Units lost"],
      rows: ownersLostList.slice(0, 200).map((o) => {
        const propIds = new Set(o.PropertyIds || []);
        const unitsForOwner = bdUnits.filter((u) => propIds.has(u.PropertyId)).length;
        return [
          o.CompanyName || `${o.FirstName || ""} ${o.LastName || ""}`.trim() || "—",
          o.ManagementAgreementEndDate || "—",
          String(unitsForOwner),
        ];
      }),
      summary: `${doorsLost} doors across ${ownersLostList.length} owners`,
    },
  };

  // ── extended drilldowns: one per tile ─────────────────────────────────────
  const propertyById = new Map(bdProperties.map((p) => [p.Id, p]));
  const propName = (pid) =>
    propertyById.get(pid)?.Name || propertyById.get(pid)?.Address?.AddressLine1 || `#${pid || "—"}`;
  const unitLabel = (u) =>
    `${u.BuildingName || u.Address?.AddressLine1 || propName(u.PropertyId)}${u.UnitNumber ? " · " + u.UnitNumber : ""}`;

  // Active leases sorted by rent (descending)
  const activeLeasesSorted = [...bdActiveLeases].sort(
    (a, b) =>
      Number(b.AccountDetails?.Rent ?? 0) - Number(a.AccountDetails?.Rent ?? 0)
  );

  const notWired = (title, reason) => ({
    title,
    cols: ["Note"],
    rows: [[reason]],
    summary: "No data source available yet",
  });

  Object.assign(drilldowns, {
    occupancy: {
      title: "Occupied units",
      cols: ["Lease ID", "Property", "Unit", "Tenant", "Rent"],
      rows: activeLeasesSorted.slice(0, 500).map((l) => [
        String(l.Id),
        propName(l.PropertyId),
        String(l.UnitNumber || l.UnitId || "—"),
        (l.CurrentTenants || [])
          .map((t) => `${t.FirstName || ""} ${t.LastName || ""}`.trim())
          .filter(Boolean)
          .join(", ") || "—",
        l.AccountDetails?.Rent != null
          ? `$${Math.round(l.AccountDetails.Rent).toLocaleString()}`
          : "—",
      ]),
      summary: `${occupiedUnits} occupied of ${totalUnits} units · ${pct(occupiedUnits, totalUnits)}%`,
    },
    renewalRate: {
      title: "Lease renewals (last 12 months)",
      cols: ["Lease ID", "Status", "Renewed from", "Renewed to", "Rent"],
      rows: renewalsRecent.slice(0, 200).map((r) => [
        String(r.Id || "—"),
        r.LeaseStatus || "—",
        r.LeaseFromDate || "—",
        r.LeaseToDate || "—",
        r.Rent != null ? `$${Math.round(r.Rent)}` : "—",
      ]),
      summary: `${renewalsInWindow} renewals · ${renewalRate}% rate (${churnedInWindow} leases ended)`,
    },
    netDoors: {
      title: "Net door change (last 12 months)",
      cols: ["Direction", "Owner", "Date", "Units"],
      rows: [
        ...ownersGainedList.map((o) => [
          "Gained",
          o.CompanyName || `${o.FirstName || ""} ${o.LastName || ""}`.trim() || "—",
          o.ManagementAgreementStartDate || "—",
          String((o.PropertyIds || []).length),
        ]),
        ...ownersLostList.map((o) => {
          const propIds = new Set(o.PropertyIds || []);
          const u = bdUnits.filter((x) => propIds.has(x.PropertyId)).length;
          return [
            "Lost",
            o.CompanyName || `${o.FirstName || ""} ${o.LastName || ""}`.trim() || "—",
            o.ManagementAgreementEndDate || "—",
            String(u),
          ];
        }),
      ],
      summary: `+${doorsAdded} added · −${doorsLost} lost · net ${netDoors >= 0 ? "+" : ""}${netDoors}`,
    },

    // ── financials ──
    rentCollectedBy3rd: {
      title: "Rent collection — by 3rd of month",
      cols: ["Month", "Snapshot day", "Paid", "Total", "% paid"],
      rows: by3rdSeries.map((s) => [
        `${MONTH_LABELS[s.month]} ${s.year}`,
        s.hasData ? "✓" : "no snapshot in window",
        s.hasData ? "—" : "—",
        s.hasData ? "—" : "—",
        s.hasData ? `${s.pct}%` : "—",
      ]),
      summary: `${by3rd.value}% avg over ${by3rd.monthsCounted} month${by3rd.monthsCounted === 1 ? "" : "s"} with snapshots`,
    },
    rentCollectedBy10th: {
      title: "Rent collection — by 10th of month",
      cols: ["Month", "Snapshot day", "% paid"],
      rows: by10thSeries.map((s) => [
        `${MONTH_LABELS[s.month]} ${s.year}`,
        s.hasData ? "captured" : "no snapshot in window",
        s.hasData ? `${s.pct}%` : "—",
      ]),
      summary: `${by10th.value}% avg over ${by10th.monthsCounted} month${by10th.monthsCounted === 1 ? "" : "s"} with snapshots`,
    },
    avgRentPerDoor: {
      title: "Active leases by rent",
      cols: ["Lease ID", "Property", "Unit", "Rent"],
      rows: activeLeasesSorted.slice(0, 500).map((l) => [
        String(l.Id),
        propName(l.PropertyId),
        String(l.UnitNumber || l.UnitId || "—"),
        l.AccountDetails?.Rent != null
          ? `$${Math.round(l.AccountDetails.Rent).toLocaleString()}`
          : "—",
      ]),
      summary: `Avg $${avgRentPerDoor.toLocaleString()} across ${monthlyRent.length} active leases`,
    },
    rpu: {
      title: "Revenue per unit (annualized rent / total units)",
      cols: ["Lease ID", "Property", "Unit", "Annualized"],
      rows: activeLeasesSorted.slice(0, 500).map((l) => {
        const r = Number(l.AccountDetails?.Rent ?? 0);
        return [
          String(l.Id),
          propName(l.PropertyId),
          String(l.UnitNumber || l.UnitId || "—"),
          r ? `$${(r * 12).toLocaleString()}` : "—",
        ];
      }),
      summary: `$${Math.round(totalRentPotential / Math.max(totalUnits, 1)).toLocaleString()}/unit annualized rent potential`,
    },
    grossIncome: {
      title: "Gross income by month (last 12)",
      cols: ["Month", "Gross ($k)"],
      rows: incomeByMonth.map((m) => [m.month, `$${m.gross}k`]),
      summary: `$${grossIncomeTotal}k total gross income`,
    },
    netIncome: {
      title: "Net income by month (last 12)",
      cols: ["Month", "Gross ($k)", "Net ($k)"],
      rows: incomeByMonth.map((m) => [m.month, `$${m.gross}k`, `$${m.net}k`]),
      summary: `$${netIncomeTotal}k total net income`,
    },

    // ── occupancy ──
    totalUnits: {
      title: "All units",
      cols: ["Unit ID", "Property", "Unit", "Bed/Bath", "Listed?"],
      rows: bdUnits.slice(0, 500).map((u) => [
        String(u.Id),
        propName(u.PropertyId),
        String(u.UnitNumber || "—"),
        `${u.UnitBedrooms || "—"} / ${u.UnitBathrooms || "—"}`,
        u.IsUnitListed ? "yes" : "no",
      ]),
      summary: `${totalUnits} total units across ${bdProperties.length} properties`,
    },
    vacantNotRented: {
      title: "Vacant units (no future lease)",
      cols: ["Unit ID", "Property", "Unit", "Market rent"],
      rows: bdUnits
        .filter(
          (u) => !occupiedUnitIds.has(u.Id) && !vacantRentedUnitIds.has(u.Id)
        )
        .slice(0, 500)
        .map((u) => [
          String(u.Id),
          propName(u.PropertyId),
          String(u.UnitNumber || "—"),
          u.MarketRent != null
            ? `$${Math.round(u.MarketRent).toLocaleString()}`
            : "—",
        ]),
      summary: `${vacantNotRentedCount} vacant, no future lease`,
    },
    vacantRented: {
      title: "Vacant units with a future lease",
      cols: ["Unit ID", "Property", "Unit", "Move-in date", "Rent"],
      rows: futureLeases
        .filter((l) => vacantRentedUnitIds.has(l.UnitId))
        .slice(0, 200)
        .map((l) => [
          String(l.UnitId),
          propName(l.PropertyId),
          String(l.UnitNumber || "—"),
          l.LeaseFromDate || "—",
          l.AccountDetails?.Rent != null
            ? `$${Math.round(l.AccountDetails.Rent).toLocaleString()}`
            : "—",
        ]),
      summary: `${vacantRentedCount} units pre-leased`,
    },
    doorsAdded: {
      title: "Doors added (owners gained, last 12 months)",
      cols: ["Owner", "Start date", "Units"],
      rows: ownersGainedList.slice(0, 200).map((o) => {
        const propIds = new Set(o.PropertyIds || []);
        const u = bdUnits.filter((x) => propIds.has(x.PropertyId)).length;
        return [
          o.CompanyName || `${o.FirstName || ""} ${o.LastName || ""}`.trim() || "—",
          o.ManagementAgreementStartDate || "—",
          String(u),
        ];
      }),
      summary: `+${doorsAdded} doors across ${ownersGainedList.length} owners`,
    },
    ownersTotal: {
      title: "All owners",
      cols: ["Owner", "Properties", "Agreement start", "Agreement end"],
      rows: bdOwners.slice(0, 500).map((o) => [
        o.CompanyName || `${o.FirstName || ""} ${o.LastName || ""}`.trim() || "—",
        String((o.PropertyIds || []).length),
        o.ManagementAgreementStartDate || "—",
        o.ManagementAgreementEndDate || "—",
      ]),
      summary: `${bdOwners.length} owners total`,
    },

    // ── leasing ──
    fixedLeases: {
      title: "Fixed-term active leases",
      cols: ["Lease ID", "Property", "Unit", "From", "To"],
      rows: bdActiveLeases
        .filter((l) => (l.LeaseType || "").toLowerCase().includes("fixed"))
        .slice(0, 500)
        .map((l) => [
          String(l.Id),
          propName(l.PropertyId),
          String(l.UnitNumber || "—"),
          l.LeaseFromDate || "—",
          l.LeaseToDate || "—",
        ]),
      summary: `${fixedLeases} fixed-term leases`,
    },
    mtmLeases: {
      title: "Month-to-month active leases",
      cols: ["Lease ID", "Property", "Unit", "Started"],
      rows: bdActiveLeases
        .filter((l) => {
          const t = (l.LeaseType || "").toLowerCase();
          return t.includes("month") || t === "atwill";
        })
        .slice(0, 500)
        .map((l) => [
          String(l.Id),
          propName(l.PropertyId),
          String(l.UnitNumber || "—"),
          l.LeaseFromDate || "—",
        ]),
      summary: `${mtmLeases} MTM leases`,
    },
    moveins: {
      title: "Move-ins (approved/moved applications)",
      cols: ["Group ID", "Status", "Unit", "Created"],
      rows: reAppGroups
        .filter((g) => /move|approved/i.test(g.status || ""))
        .slice(-200)
        .reverse()
        .map((g) => [
          String(g.id || g.group_id || ""),
          g.status || "—",
          String(g.unit_id || g.unit?.id || "—"),
          (g.created_at || "").slice(0, 10),
        ]),
      summary: `${moveins} move-ins from ${appsSubmitted} applications`,
    },
    appsPerMovein: {
      title: "Applications-to-move-in funnel",
      cols: ["Stage", "Count"],
      rows: [
        ["Applications submitted", String(appsSubmitted)],
        ["Move-ins / approvals", String(moveins)],
        ["Apps per move-in", moveins ? (appsSubmitted / moveins).toFixed(1) : "—"],
      ],
      summary: `${moveins ? (appsSubmitted / moveins).toFixed(1) : "—"} applications per move-in`,
    },

    // ── marketing ──
    medianDaysOnMarket: {
      title: "Units currently on market (by days listed)",
      cols: ["Unit ID", "Status", "Listed since", "Days"],
      rows: reAvailable
        .map((u) => ({
          u,
          days: u.created_at
            ? Math.floor((now - new Date(u.created_at)) / (1000 * 60 * 60 * 24))
            : 0,
        }))
        .sort((a, b) => a.days - b.days)
        .map(({ u, days }) => [
          String(u.id),
          u.status || "—",
          (u.created_at || "").slice(0, 10),
          String(days),
        ]),
      summary: `Median ${medianDaysOnMarket} days · avg ${avgDaysOnMarket} days · ${unitsOnMarket} listed`,
    },
    unitsOnMarket: {
      title: "Units currently on market",
      cols: ["Unit ID", "Status", "Listed since", "Days"],
      rows: reAvailable.slice(0, 200).map((u) => {
        const days = u.created_at
          ? Math.floor((now - new Date(u.created_at)) / (1000 * 60 * 60 * 24))
          : 0;
        return [
          String(u.id),
          u.status || "—",
          (u.created_at || "").slice(0, 10),
          String(days),
        ];
      }),
      summary: `${unitsOnMarket} units listed`,
    },
    completionRate: notWired(
      "Showing completion rate",
      "RentEngine's public API doesn't expose showing events, so this metric will read 0 until a Meld or call/text source is connected."
    ),
    showingsCompleted: notWired(
      "Showings completed",
      "RentEngine's public API doesn't expose showing events. Connect Meld or another source to populate."
    ),
    totalCalls: notWired(
      "Total calls",
      "No call/voice integration is wired yet. Connect a phone source (e.g. CallRail, OpenPhone) to populate."
    ),
    totalTexts: notWired(
      "Outbound texts",
      "No SMS integration is wired yet. Connect a messaging source to populate."
    ),
  });

  // ── live-metrics flag — drill keys backed by real, live API data ──────────
  const liveMetrics = [
    // financials
    "delinquent",
    "delinquentCount",
    "rentCollectedBy3rd",
    "rentCollectedBy10th",
    "avgRentPerDoor",
    "rpu",
    "grossIncome",
    "netIncome",
    // occupancy
    "occupancy",
    "totalUnits",
    "vacantNotRented",
    "vacantRented",
    "avgDaysVacant",
    "doorsAdded",
    "doorsLost",
    "netDoors",
    "ownersTotal",
    "ownersGained",
    // leasing
    "renewalRate",
    "renewalsCount",
    "fixedLeases",
    "mtmLeases",
    "appsSubmitted",
    "moveins",
    "appsPerMovein",
    "evictionsPending",
    // marketing
    "avgDaysOnMarket",
    "medianDaysOnMarket",
    "unitsOnMarket",
    "newProspects",
  ];
  meta.liveMetrics = liveMetrics;

  return { dashboard, drilldowns };
}
