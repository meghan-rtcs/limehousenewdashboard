import { query, queryOne } from "./db.js";
import { rentengine } from "./rentengine.js";
import { buildium } from "./buildium.js";

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── SIGN CONVENTION ──────────────────────────────────────────────────────────
// After running /api/test-gl, set this based on Buildium's actual behavior.
// If income GL entries come back NEGATIVE (standard credit convention): true
// If income GL entries come back POSITIVE: false
const NEGATE_INCOME = false;
const NEGATE_EXPENSE = false;

function pct(n, d) { return d ? Math.round((n / d) * 1000) / 10 : 0; }
function buildKpi(value, prevYear = 0, opts = {}) {
  return { value: value ?? 0, prevYear: prevYear ?? 0, ...opts };
}
function toET(d) {
  return new Date(d).toLocaleString("en-US", { timeZone: "America/New_York" });
}
function safe(promise, fallback) {
  return promise.catch((err) => { console.warn("[agg] non-fatal:", err.message); return fallback; });
}

export async function buildDashboard() {
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const syncedAt = toET(now).replace(",", " ·");
  const yearAgoIso = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10);

  // ── RentEngine data (still live — not in DB yet) ───────────────────────
  const yearAgoFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)).toISOString();
  const [reUnits, reProspects, reAppGroups, bdApplicants] = await Promise.all([
    safe(rentengine.listUnits(), []),
    safe(rentengine.listProspects(yearAgoFrom, now.toISOString()), []),
    safe(rentengine.listApplicationGroups({ createdAfter: yearAgoFrom, createdBefore: now.toISOString() }), []),
    safe(buildium.listApplicants(), []),
  ]);

  // Buildium applications submitted in the trailing 12 months
  // Each applicant record has Applications[] with ApplicationSubmittedDateTime.
  const yearAgoMs = new Date(yearAgoIso).getTime();
  const submittedApps = [];
  for (const a of bdApplicants) {
    for (const app of a.Applications || []) {
      const ts = app.ApplicationSubmittedDateTime;
      if (!ts) continue;
      const t = new Date(ts).getTime();
      if (t >= yearAgoMs && t <= now.getTime()) {
        submittedApps.push({ applicant: a, app });
      }
    }
  }

  // ── META ─────────────────────────────────────────────────────────────────
  const totalUnits = queryOne("SELECT COUNT(*) as c FROM units u JOIN properties p ON u.property_id = p.id WHERE p.is_active = 1")?.c || 0;
  const activeLeaseCount = queryOne("SELECT COUNT(*) as c FROM leases l JOIN units u ON l.unit_id = u.id JOIN properties p ON u.property_id = p.id WHERE l.status = 'Active' AND p.is_active = 1")?.c || 0;

  const meta = {
    syncedAt, buildiumUnits: totalUnits, rentEngineUnits: reUnits.length, activeLeases: activeLeaseCount,
    liveMetrics: [
      "delinquent","delinquentCount","rentCollectedBy3rd","rentCollectedBy10th",
      "avgRentPerDoor","rpu","grossIncome","netIncome",
      "occupancy","totalUnits","vacantNotRented","vacantRented","avgDaysVacant",
      "doorsLost","netDoors","ownersTotal","ownersGained",
      "renewalRate","renewalsCount","fixedLeases","mtmLeases",
      "appsSubmitted","moveins","appsPerMovein","evictionsPending",
      "avgDaysOnMarket","medianDaysOnMarket","unitsOnMarket","newProspects",
    ],
  };

  // ── OCCUPANCY (using IsUnitOccupied) ───────────────────────────────────
  // Source of truth for occupancy = active leases (matches the "208 leases" header
  // and avoids stale Buildium `is_occupied` flags that linger after move-out).
  const occupiedUnits = queryOne(`SELECT COUNT(DISTINCT l.unit_id) as c FROM leases l JOIN units u ON l.unit_id = u.id JOIN properties p ON u.property_id = p.id WHERE l.status = 'Active' AND p.is_active = 1`)?.c || 0;
  const vacantUnits = Math.max(totalUnits - occupiedUnits, 0);

  const futureLeaseUnitIds = query(`SELECT DISTINCT l.unit_id FROM leases l JOIN units u ON l.unit_id = u.id JOIN properties p ON u.property_id = p.id WHERE l.status = 'Future' AND l.from_date > ? AND p.is_active = 1 AND l.unit_id NOT IN (SELECT unit_id FROM leases WHERE status = 'Active')`, [todayIso]);
  const vacantRentedCount = futureLeaseUnitIds.length;
  const vacantNotRentedCount = Math.max(vacantUnits - vacantRentedCount, 0);

  const vacantDaysRows = query(`SELECT u.id as unit_id, MAX(l.to_date) as last_end FROM units u JOIN properties p ON u.property_id = p.id LEFT JOIN leases l ON l.unit_id = u.id AND l.status = 'Past' WHERE p.is_active = 1 AND u.id NOT IN (SELECT unit_id FROM leases WHERE status = 'Active') GROUP BY u.id HAVING last_end IS NOT NULL`);
  const vacantDays = vacantDaysRows.map(r => Math.max(0, Math.floor((now - new Date(r.last_end)) / 86400000))).filter(d => Number.isFinite(d));
  const avgDaysVacant = vacantDays.length ? Math.round(vacantDays.reduce((a, b) => a + b, 0) / vacantDays.length) : 0;

  // ── DOORS ──────────────────────────────────────────────────────────────
  const ownersLostRows = query(`SELECT id, name, agreement_end, property_ids FROM owners WHERE agreement_end IS NOT NULL AND agreement_end >= ? AND agreement_end <= ?`, [yearAgoIso, todayIso]);
  let doorsLost = 0;
  const ownersLostWithDoors = ownersLostRows.map(o => {
    const pids = JSON.parse(o.property_ids || "[]");
    const doors = pids.length ? (queryOne(`SELECT COUNT(*) as c FROM units WHERE property_id IN (${pids.join(",")})`)?.c || 0) : 0;
    doorsLost += doors;
    return { ...o, doors };
  });
  const ownersGainedRows = query(`SELECT id, name, agreement_start, property_ids FROM owners WHERE agreement_start IS NOT NULL AND agreement_start >= ? AND agreement_start <= ?`, [yearAgoIso, todayIso]);
  let doorsAdded = 0;
  const ownersGainedWithDoors = ownersGainedRows.map(o => {
    const pids = JSON.parse(o.property_ids || "[]");
    const doors = pids.length ? (queryOne(`SELECT COUNT(*) as c FROM units WHERE property_id IN (${pids.join(",")})`)?.c || 0) : 0;
    doorsAdded += doors;
    return { ...o, doors };
  });
  const ownersTotal = queryOne("SELECT COUNT(*) as c FROM owners WHERE is_active = 1")?.c || 0;
  const netDoors = doorsAdded - doorsLost;

  const occupancy = {
    rate: buildKpi(pct(occupiedUnits, totalUnits), 0, { unit: "%" }),
    occupiedUnits, totalUnits,
    vacantNotRented: buildKpi(vacantNotRentedCount, 0, { invertDelta: true }),
    vacantRented: buildKpi(vacantRentedCount, 0),
    avgDaysVacant: buildKpi(avgDaysVacant, 0, { invertDelta: true }),
    doorsAdded: buildKpi(doorsAdded, 0),
    doorsLost: buildKpi(doorsLost, 0, { invertDelta: true }),
    netDoors: buildKpi(netDoors, 0),
    ownersTotal: buildKpi(ownersTotal, 0),
    ownersGained: buildKpi(ownersGainedRows.length, 0),
  };

  // ── LEASING ────────────────────────────────────────────────────────────
  const fixedLeases = queryOne(`SELECT COUNT(*) as c FROM leases l JOIN units u ON l.unit_id = u.id JOIN properties p ON u.property_id = p.id WHERE l.status = 'Active' AND p.is_active = 1 AND (l.type = 'Fixed' OR l.type = 'FixedWithRollover')`)?.c || 0;
  const mtmLeases = queryOne(`SELECT COUNT(*) as c FROM leases l JOIN units u ON l.unit_id = u.id JOIN properties p ON u.property_id = p.id WHERE l.status = 'Active' AND p.is_active = 1 AND l.type = 'AtWill'`)?.c || 0;

  const renewalsInWindow = queryOne(`SELECT COUNT(*) as c FROM renewal_history WHERE created_at >= ?`, [yearAgoIso])?.c || 0;
  const churnedInWindow = queryOne(`SELECT COUNT(*) as c FROM leases l JOIN units u ON l.unit_id = u.id JOIN properties p ON u.property_id = p.id WHERE l.status = 'Past' AND p.is_active = 1 AND l.to_date >= ? AND l.to_date <= ?`, [yearAgoIso, todayIso])?.c || 0;
  const renewalDenominator = renewalsInWindow + churnedInWindow;
  const renewalRate = renewalDenominator ? Math.round((renewalsInWindow / renewalDenominator) * 1000) / 10 : 0;
  const evictionsPendingCount = queryOne(`SELECT COUNT(*) as c FROM leases l JOIN units u ON l.unit_id = u.id JOIN properties p ON u.property_id = p.id WHERE l.status = 'Active' AND l.is_eviction_pending = 1 AND p.is_active = 1`)?.c || 0;

  const appsSubmitted = submittedApps.length;
  // Move-ins from Buildium: leases that started in the trailing 12 months and aren't Future
  const moveinsRows = query(`SELECT l.id, l.from_date FROM leases l JOIN units u ON l.unit_id = u.id JOIN properties p ON u.property_id = p.id WHERE p.is_active = 1 AND l.status != 'Future' AND l.from_date >= ? AND l.from_date <= ?`, [yearAgoIso, todayIso]);
  const moveins = moveinsRows.length;

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

  // ── FINANCIALS ─────────────────────────────────────────────────────────
  const latestSnap = queryOne("SELECT * FROM daily_snapshots ORDER BY date DESC LIMIT 1");
  const delinquentCount = latestSnap?.delinquent_count || 0;
  // Pull the exact (un-rounded) total from outstanding_snapshots so the tile shows cents.
  const latestObSnapDate = queryOne("SELECT MAX(snapshot_date) as d FROM outstanding_snapshots")?.d;
  const exactDelinqRow = latestObSnapDate ? queryOne("SELECT SUM(total_balance) as t FROM outstanding_snapshots WHERE snapshot_date = ?", [latestObSnapDate]) : null;
  const delinquentTotal = exactDelinqRow?.t ?? (latestSnap?.delinquent_total || 0);

  const rentResult = queryOne(`SELECT AVG(l.rent) as avg_rent, SUM(l.rent) as total_rent FROM leases l JOIN units u ON l.unit_id = u.id JOIN properties p ON u.property_id = p.id WHERE l.status = 'Active' AND p.is_active = 1 AND l.rent > 0`);
  const avgRentPerLease = Math.round(rentResult?.avg_rent || 0);
  const totalRentPotential = rentResult?.total_rent || 0;

  // Monthly GL income (last 12 months)
  const months = [];
  const ytdMonthCount = now.getUTCMonth() + 1;
  for (let i = 0; i < ytdMonthCount; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), i, 1));
    months.push({
      label: MONTH_LABELS[d.getUTCMonth()], year: d.getUTCFullYear(),
      start: d.toISOString().slice(0, 10),
      end: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10),
    });
  }

  const incSign = NEGATE_INCOME ? "ABS(amount)" : "amount";
  const expSign = NEGATE_EXPENSE ? "ABS(amount)" : "amount";

  const incomeByMonth = months.map(m => {
    const row = queryOne(`SELECT SUM(CASE WHEN gl_account_type = 'Income' THEN ${incSign} ELSE 0 END) as gross, SUM(CASE WHEN gl_account_type = 'Expense' THEN ${expSign} ELSE 0 END) as expense FROM gl_entries WHERE date >= ? AND date <= ?`, [m.start, m.end]);
    const gross = Math.round(row?.gross || 0);
    const expense = Math.round(row?.expense || 0);
    return { month: m.label, gross, net: gross - expense, _expense: expense };
  });
  const grossIncomeTotal = incomeByMonth.reduce((s, m) => s + m.gross, 0);
  const netIncomeTotal = incomeByMonth.reduce((s, m) => s + m.net, 0);

  // RPU = last complete month GL income / units
  const lcm = months.length >= 2 ? months[months.length - 2] : months[0]; // last complete month YTD
  const rpuIncome = lcm ? (queryOne(`SELECT SUM(CASE WHEN gl_account_type = 'Income' AND gl_account_name NOT IN ('Rent Income','Deposits to be Refunded - Income','Insurance Claim','Owner - Non Refundable Pet Fee','Interest Income') THEN ABS(amount) ELSE 0 END) as inc FROM gl_entries WHERE date >= ? AND date <= ?`, [lcm.start, lcm.end])?.inc || 0) : 0;
  const rpuValue = totalUnits ? Math.round(rpuIncome / totalUnits) : 0;

  // Rent collection by Nth (from daily_snapshots)
  function rentByDay(N) {
    let paid = 0, total = 0, counted = 0;
    for (let i = 0; i < 6; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const prefix = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const snap = queryOne(`SELECT * FROM daily_snapshots WHERE date LIKE ? AND CAST(substr(date, 9, 2) AS INTEGER) BETWEEN ? AND ? ORDER BY date ASC LIMIT 1`, [`${prefix}%`, N, N + 5]);
      if (snap && snap.active_leases) { paid += snap.paid_lease_count; total += snap.active_leases; counted++; }
    }
    return { value: total ? Math.round((paid / total) * 1000) / 10 : 0, monthsCounted: counted };
  }
  const by3rd = rentByDay(3);
  const by10th = rentByDay(10);

  // YTD income (Jan 1 of current year to today)
  const ytdStart = now.getUTCFullYear() + "-01-01";
  const ytdGross = queryOne(`SELECT SUM(CASE WHEN gl_account_type = 'Income' THEN amount ELSE 0 END) as total FROM gl_entries WHERE date >= ?`, [ytdStart])?.total || 0;
  const ytdExpense = queryOne(`SELECT SUM(CASE WHEN gl_account_type = 'Expense' THEN amount ELSE 0 END) as total FROM gl_entries WHERE date >= ?`, [ytdStart])?.total || 0;
  const ytdNet = ytdGross - ytdExpense;

  const financials = {
    rentCollectedBy3rd: buildKpi(by3rd.value, 0, { unit: "%" }),
    rentCollectedBy10th: buildKpi(by10th.value, 0, { unit: "%" }),
    avgRentPerDoor: buildKpi(avgRentPerLease, 0, { unit: "$" }),
    rpu: buildKpi(rpuValue, 0, { unit: "$" }),
    grossIncome: buildKpi(Math.round(ytdGross), 0, { unit: "$" }),
    netIncome: buildKpi(Math.round(ytdNet), 0, { unit: "$" }),
    delinquent: buildKpi(Math.round(delinquentTotal * 100) / 100, 0, { unit: "$", invertDelta: true }),
    delinquentCount: buildKpi(delinquentCount, 0, { invertDelta: true }),
  };

  // ── MARKETING (RentEngine) ─────────────────────────────────────────────
  const newProspects = reProspects.length;
  const sourceCounts = {};
  for (const p of reProspects) { const s = p.source || "Other"; sourceCounts[s] = (sourceCounts[s] || 0) + 1; }
  const SOURCE_COLORS = { Zillow: "#3d8c1f", "Apartments.com": "#2471a3", Trulia: "#7d3c98", Direct: "#d68910", Other: "#aab5a3" };
  const prospectsBySource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, color: SOURCE_COLORS[label] || "#aab5a3" }));

  const reAvailable = reUnits.filter(u => !u.is_occupied && /avail|list|market/i.test(u.status || ""));
  const unitsOnMarket = reAvailable.length;
  const dom = reAvailable.map(u => u.created_at ? Math.max(0, Math.floor((now - new Date(u.created_at)) / 86400000)) : null).filter(v => v !== null);
  const avgDaysOnMarket = dom.length ? Math.round(dom.reduce((a, b) => a + b, 0) / dom.length) : 0;
  const sortedDom = [...dom].sort((a, b) => a - b);
  const medianDaysOnMarket = sortedDom.length ? sortedDom[Math.floor(sortedDom.length / 2)] : 0;

  const marketing = {
    unitsOnMarket: buildKpi(unitsOnMarket, 0, { invertDelta: true }),
    avgDaysOnMarket: buildKpi(avgDaysOnMarket, 0, { invertDelta: true }),
    medianDaysOnMarket: buildKpi(medianDaysOnMarket, 0, { invertDelta: true }),
    newProspects: buildKpi(newProspects, 0),
    showingsCompleted: buildKpi(0, 0), totalCalls: buildKpi(0, 0),
    totalTexts: buildKpi(0, 0), completionRate: buildKpi(0, 0, { unit: "%" }),
  };

  // ── SPARKLINES ─────────────────────────────────────────────────────────
  const flat = v => Array(12).fill(v);
  const prospectsByMonth = months.map(() => 0);
  for (const p of reProspects) { const d = new Date(p.created_at); const idx = months.findIndex(m => m.start.slice(0, 7) === d.toISOString().slice(0, 7)); if (idx >= 0) prospectsByMonth[idx]++; }

  const renewalsByMonthCount = months.map(m => queryOne(`SELECT COUNT(*) as c FROM renewal_history WHERE created_at >= ? AND created_at < ?`, [m.start, m.end])?.c || 0);

  const spark = {
    occupancy: flat(occupancy.rate.value),
    rentCollected3rd: flat(by3rd.value), rentCollected10th: flat(by10th.value),
    doorsAdded: flat(0), doorsLost: flat(0),
    renewalRate: renewalsByMonthCount,
    avgRent: flat(avgRentPerLease), rpu: flat(rpuValue),
    grossIncome: incomeByMonth.map(m => m.gross), netIncome: incomeByMonth.map(m => m.net),
    daysOnMarket: flat(avgDaysOnMarket),
    delinquent: flat(financials.delinquent.value),
    prospects: prospectsByMonth, showings: flat(0),
  };

  // ── CHART DATA ─────────────────────────────────────────────────────────
  const rentCollectionByMonth = months.map(m => ({ month: m.label, by3rd: 0, by10th: 0 }));
  const doorsMonthly = months.map(m => ({ month: m.label, added: 0, lost: 0 }));
  const renewalsByMonth = months.map((m, i) => ({ month: m.label, count: renewalsByMonthCount[i] || 0 }));
  const occupancyTrend = months.map(m => ({ month: m.label, rate: occupancy.rate.value }));
  const delinquentTrend = months.map(m => ({ month: m.label, amount: +(financials.delinquent.value / 1000).toFixed(1) }));

  // Aging buckets from latest outstanding snapshot
  const latestObDate = queryOne("SELECT MAX(snapshot_date) as d FROM outstanding_snapshots")?.d;
  const agingBuckets = [
    { label: "0–30", amount: 0, color: "#d68910" }, { label: "31–60", amount: 0, color: "#3d8c1f" },
    { label: "61–90", amount: 0, color: "#c0392b" }, { label: "90+", amount: 0, color: "#8b1f15" },
  ];
  if (latestObDate) {
    const ag = queryOne("SELECT SUM(balance_0_30) as b0, SUM(balance_31_60) as b1, SUM(balance_61_90) as b2, SUM(balance_over_90) as b3 FROM outstanding_snapshots WHERE snapshot_date = ?", [latestObDate]);
    if (ag) { agingBuckets[0].amount = Math.round(ag.b0 || 0); agingBuckets[1].amount = Math.round(ag.b1 || 0); agingBuckets[2].amount = Math.round(ag.b2 || 0); agingBuckets[3].amount = Math.round(ag.b3 || 0); }
  }

  const healthCounts = { Healthy: occupiedUnits, "At-risk": delinquentCount, Waitlist: 0, "On Hold": 0, "Off-Market": vacantUnits };
  const marketingFunnel = [
    { label: "Prospects", value: newProspects }, { label: "Showings scheduled", value: 0 },
    { label: "Showings completed", value: 0 }, { label: "Applications", value: appsSubmitted },
    { label: "Move-ins", value: moveins },
  ];

  // ── YoY Chart Data ─────────────────────────────────────────────────────
  const goiYoY = query(`SELECT CAST(strftime('%Y', date) AS INTEGER) as year, CAST(strftime('%m', date) AS INTEGER) as month, SUM(CASE WHEN gl_account_type = 'Income' THEN ${incSign} ELSE 0 END) - SUM(CASE WHEN gl_account_type = 'Expense' THEN ${expSign} ELSE 0 END) as oi FROM gl_entries GROUP BY year, month ORDER BY year, month`);
  const goiByYear = {};
  for (const r of goiYoY) { if (!goiByYear[r.year]) goiByYear[r.year] = {}; goiByYear[r.year][r.month] = Math.round(r.oi); }

  // RPU YoY uses the same operating-revenue exclusions as the RPU tile so the
  // line chart and the tile agree (both = PM operating revenue per unit).
  const rpuYoY = query(`SELECT CAST(strftime('%Y', date) AS INTEGER) as year, CAST(strftime('%m', date) AS INTEGER) as month, SUM(CASE WHEN gl_account_type = 'Income' AND gl_account_name NOT IN ('Rent Income','Deposits to be Refunded - Income','Insurance Claim','Owner - Non Refundable Pet Fee','Interest Income') THEN ABS(amount) ELSE 0 END) as inc FROM gl_entries GROUP BY year, month ORDER BY year, month`);
  const rpuByYear = {};
  for (const r of rpuYoY) {
    if (!rpuByYear[r.year]) rpuByYear[r.year] = {};
    const snapUnits = queryOne("SELECT total_units FROM daily_snapshots WHERE date LIKE ? ORDER BY date DESC LIMIT 1", [`${r.year}-${String(r.month).padStart(2, "0")}%`])?.total_units || totalUnits;
    rpuByYear[r.year][r.month] = snapUnits > 0 ? Math.round(r.inc / snapUnits) : 0;
  }

  // ── ASSEMBLE ───────────────────────────────────────────────────────────
  const dashboard = {
    meta, spark, financials, occupancy, leasing, marketing,
    rentCollectionByMonth, doorsMonthly, renewalsByMonth,
    healthCounts, agingBuckets, prospectsBySource, marketingFunnel,
    delinquentTrend, incomeMonthly: incomeByMonth, occupancyTrend,
    rentIncreaseDistribution: [], rentCollectionDetail: [], doorsAddedDetail: [],
    goiByYear, rpuByYear,
  };

  // ── DRILLDOWNS (simplified — full list for each tile) ──────────────────
  const propMap = new Map(query("SELECT id, name FROM properties").map(p => [p.id, p.name]));
  const propName = pid => propMap.get(pid) || `#${pid || "—"}`;
  const notWired = (title, reason) => ({ title, cols: ["Note"], rows: [[reason]], summary: "No data" });
  const activeLeaseRows = query(`SELECT l.id, l.property_id, u.unit_number, l.rent, l.type, l.from_date, l.to_date FROM leases l JOIN units u ON l.unit_id = u.id JOIN properties p ON u.property_id = p.id WHERE l.status = 'Active' AND p.is_active = 1 ORDER BY l.rent DESC LIMIT 500`);

  const drilldowns = {
    delinquent: { title: "Delinquent leases", cols: ["Lease ID", "Balance"], rows: latestObDate ? query("SELECT lease_id, total_balance FROM outstanding_snapshots WHERE snapshot_date = ? ORDER BY total_balance DESC LIMIT 200", [latestObDate]).map(r => [String(r.lease_id), `$${(r.total_balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]) : [], summary: `${delinquentCount} leases · $${(delinquentTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    occupancy: { title: "Occupied units", cols: ["Lease", "Property", "Unit", "Rent"], rows: activeLeaseRows.map(l => [String(l.id), propName(l.property_id), l.unit_number || "—", l.rent ? `$${Math.round(l.rent).toLocaleString()}` : "—"]), summary: `${occupiedUnits}/${totalUnits} · ${pct(occupiedUnits, totalUnits)}%` },
    totalUnits: { title: "All units", cols: ["ID", "Property", "Unit", "Occupied"], rows: query("SELECT u.id, u.property_id, u.unit_number, u.is_occupied FROM units u JOIN properties p ON u.property_id = p.id WHERE p.is_active = 1 LIMIT 500").map(u => [String(u.id), propName(u.property_id), u.unit_number || "—", u.is_occupied ? "yes" : "no"]), summary: `${totalUnits} units` },
    vacantNotRented: { title: "Vacant (no future lease)", cols: ["ID", "Property", "Unit"], rows: query(`SELECT u.id, u.property_id, u.unit_number FROM units u JOIN properties p ON u.property_id = p.id WHERE p.is_active = 1 AND u.id NOT IN (SELECT unit_id FROM leases WHERE status = 'Active') AND u.id NOT IN (SELECT DISTINCT unit_id FROM leases WHERE status = 'Future' AND from_date > ?) LIMIT 500`, [todayIso]).map(u => [String(u.id), propName(u.property_id), u.unit_number || "—"]), summary: `${vacantNotRentedCount} vacant` },
    vacantRented: { title: "Vacant with future lease", cols: ["Unit", "Lease starts"], rows: futureLeaseUnitIds.length ? query(`SELECT u.unit_number, l.from_date FROM leases l JOIN units u ON l.unit_id = u.id WHERE l.status = 'Future' AND l.from_date > ? AND u.id NOT IN (SELECT unit_id FROM leases WHERE status = 'Active') LIMIT 200`, [todayIso]).map(r => [r.unit_number || "—", r.from_date || "—"]) : [], summary: `${vacantRentedCount} pre-leased` },
    avgDaysVacant: { title: "Vacant units", cols: ["Unit", "Days vacant"], rows: query(`SELECT u.id, u.unit_number, MAX(l.to_date) as last_end FROM units u JOIN properties p ON u.property_id = p.id LEFT JOIN leases l ON l.unit_id = u.id AND l.status = 'Past' WHERE p.is_active = 1 AND u.id NOT IN (SELECT unit_id FROM leases WHERE status = 'Active') GROUP BY u.id ORDER BY last_end DESC LIMIT 500`).map(r => [r.unit_number || String(r.id), r.last_end ? String(Math.max(0, Math.floor((now - new Date(r.last_end)) / 86400000))) : "Never rented"]), summary: `Avg ${avgDaysVacant} days · ${vacantUnits} vacant (${vacantDaysRows.length} with prior leases)` },
    doorsAdded: { title: "Doors added (trailing 12 mo)", cols: ["Owner", "Start date", "Doors"], rows: ownersGainedWithDoors.map(o => [o.name, o.agreement_start || "—", String(o.doors)]), summary: `${doorsAdded} doors across ${ownersGainedWithDoors.length} owners`, note: "Counted from each owner's Management Agreement Start Date in Buildium. Important: this only counts when the Start Date is filled in — please make sure to record the start date in Buildium when an owner onboards, otherwise added doors won't show up here. (Currently only 23 of 366 owners have a start date recorded.)" },
    doorsLost: { title: "Doors lost (trailing 12 mo)", cols: ["Owner", "End date", "Doors"], rows: ownersLostWithDoors.map(o => [o.name, o.agreement_end || "—", String(o.doors)]), summary: `${doorsLost} doors across ${ownersLostWithDoors.length} owners`, note: "Counted from each owner's Management Agreement End Date in Buildium. Important: this only counts when the End Date is filled in — please make sure to record the end date in Buildium when an owner offboards, otherwise lost doors won't show up here." },
    netDoors: { title: "Net doors (trailing 12 mo)", cols: ["Type", "Count"], rows: [["Doors added", String(doorsAdded)], ["Doors lost", String(doorsLost)], ["Net", String(netDoors >= 0 ? "+" + netDoors : netDoors)]], summary: `Net ${netDoors >= 0 ? "+" + netDoors : netDoors}`, note: "Added uses Management Agreement Start Date; Lost uses Management Agreement End Date. Important: lost doors only count when the End Date is recorded in Buildium — please update the agreement end date when offboarding an owner so this stays accurate." },
    ownersGained: { title: "Owners gained", cols: ["Owner", "Start"], rows: ownersGainedRows.map(o => [o.name, o.agreement_start || "—"]), summary: `${ownersGainedRows.length} owners` },
    ownersTotal: { title: "All owners", cols: ["Owner", "Active", "Start", "End"], rows: query("SELECT name, is_active, agreement_start, agreement_end FROM owners LIMIT 500").map(o => [o.name, o.is_active ? "yes" : "no", o.agreement_start || "—", o.agreement_end || "—"]), summary: `${ownersTotal} owners` },
    renewalRate: { title: "Renewals", cols: ["ID", "Status", "From", "To", "Rent"], rows: query("SELECT id, status, from_date, to_date, rent FROM renewal_history WHERE created_at >= ? ORDER BY created_at DESC LIMIT 200", [yearAgoIso]).map(r => [String(r.id), r.status, r.from_date || "—", r.to_date || "—", r.rent != null ? `$${Math.round(r.rent)}` : "—"]), summary: `${renewalsInWindow} renewals · ${renewalRate}%` },
    renewalsCount: { title: "Renewals", cols: ["ID", "From", "To"], rows: query("SELECT id, from_date, to_date FROM renewal_history WHERE created_at >= ? ORDER BY created_at DESC LIMIT 200", [yearAgoIso]).map(r => [String(r.id), r.from_date || "—", r.to_date || "—"]), summary: `${renewalsInWindow}` },
    fixedLeases: { title: "Fixed leases", cols: ["ID", "Property", "Unit", "From", "To"], rows: activeLeaseRows.filter(l => l.type === "Fixed" || l.type === "FixedWithRollover").map(l => [String(l.id), propName(l.property_id), l.unit_number || "—", l.from_date || "—", l.to_date || "—"]), summary: `${fixedLeases}` },
    mtmLeases: { title: "MTM leases", cols: ["ID", "Property", "Unit"], rows: activeLeaseRows.filter(l => l.type === "AtWill").map(l => [String(l.id), propName(l.property_id), l.unit_number || "—"]), summary: `${mtmLeases}` },
    evictionsPending: { title: "Evictions", cols: ["Lease", "Unit"], rows: query("SELECT l.id, u.unit_number FROM leases l JOIN units u ON l.unit_id = u.id JOIN properties p ON u.property_id = p.id WHERE l.status = 'Active' AND l.is_eviction_pending = 1 AND p.is_active = 1 LIMIT 200").map(l => [String(l.id), l.unit_number || "—"]), summary: `${evictionsPendingCount}` },
    avgRentPerDoor: { title: "Leases by rent", cols: ["ID", "Property", "Rent"], rows: activeLeaseRows.map(l => [String(l.id), propName(l.property_id), l.rent ? `$${Math.round(l.rent).toLocaleString()}` : "—"]), summary: `Avg $${avgRentPerLease}` },
    rpu: { title: "Revenue per unit", cols: ["Month", "RPU"], rows: incomeByMonth.map(m => [m.month, `$${totalUnits ? Math.round((m.gross) / totalUnits) : 0}`]), summary: `$${rpuValue}/unit` },
    grossIncome: { title: "Gross income (12mo)", cols: ["Month", "Gross ($k)"], rows: incomeByMonth.map(m => [m.month, `$${m.gross}k`]), summary: `$${grossIncomeTotal}k` },
    netIncome: { title: "Net income (12mo)", cols: ["Month", "Gross", "Net"], rows: incomeByMonth.map(m => [m.month, `$${m.gross}k`, `$${m.net}k`]), summary: `$${netIncomeTotal}k` },
    rentCollectedBy3rd: { title: "Rent by 3rd", cols: ["Note"], rows: [["Snapshots accumulate over time."]], summary: `${by3rd.value}% (${by3rd.monthsCounted} months)` },
    rentCollectedBy10th: { title: "Rent by 10th", cols: ["Note"], rows: [["Snapshots accumulate over time."]], summary: `${by10th.value}% (${by10th.monthsCounted} months)` },
    newProspects: { title: "Prospects", cols: ["Name", "Source", "Created"], rows: reProspects.slice(-200).reverse().map(p => [p.name || "—", p.source || "—", (p.created_at || "").slice(0, 10)]), summary: `${newProspects} prospects` },
    appsSubmitted: { title: "Applications submitted (last 12 mo)", cols: ["Applicant", "Status", "App #", "Submitted"], rows: submittedApps.slice().sort((x, y) => (y.app.ApplicationSubmittedDateTime || "").localeCompare(x.app.ApplicationSubmittedDateTime || "")).slice(0, 500).map(({ applicant, app }) => [`${applicant.FirstName || ""} ${applicant.LastName || ""}`.trim() || "—", app.ApplicationStatus || applicant.Status || "—", app.ApplicationNumber || String(app.Id || ""), (app.ApplicationSubmittedDateTime || "").slice(0, 10)]), summary: `${appsSubmitted} applications submitted` },
    moveins: { title: "Move-ins (last 12 mo)", cols: ["Lease", "Start"], rows: moveinsRows.slice(-200).reverse().map(r => [String(r.id), r.from_date || "—"]), summary: `${moveins} move-ins` },
    appsPerMovein: { title: "Funnel", cols: ["Stage", "Count"], rows: [["Apps", String(appsSubmitted)], ["Move-ins", String(moveins)], ["Ratio", moveins ? (appsSubmitted / moveins).toFixed(1) : "—"]], summary: moveins ? `${(appsSubmitted / moveins).toFixed(1)} apps per move-in` : "—" },
    completionRate: notWired("Completion rate", "No showing source."),
    showingsCompleted: notWired("Showings", "No showing source."),
    totalCalls: notWired("Calls", "No phone source."),
    totalTexts: notWired("Texts", "No SMS source."),
    unitsOnMarket: { title: "On market", cols: ["ID", "Status", "Days"], rows: reAvailable.slice(0, 200).map(u => { const d = u.created_at ? Math.floor((now - new Date(u.created_at)) / 86400000) : 0; return [String(u.id), u.status || "—", String(d)]; }), summary: `${unitsOnMarket} listed` },
    avgDaysOnMarket: { title: "Days on market", cols: ["ID", "Days"], rows: reAvailable.slice(0, 200).map(u => [String(u.id), String(u.created_at ? Math.floor((now - new Date(u.created_at)) / 86400000) : 0)]), summary: `Avg ${avgDaysOnMarket} · Median ${medianDaysOnMarket}` },
    medianDaysOnMarket: { title: "Median DOM", cols: ["ID", "Days"], rows: [], summary: `Median ${medianDaysOnMarket} days` },
  };

  return { dashboard, drilldowns };
}
