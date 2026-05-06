import { buildium } from "./buildium.js";
import { rentengine } from "./rentengine.js";
import { getDb, upsertMany, clearTable, run, query, queryOne } from "./db.js";

const TS = () => new Date().toISOString();
const fmtDate = (d) => (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);

function safe(promise, fallback) {
  return promise.catch((err) => {
    console.warn("[sync] non-fatal:", err.message);
    return fallback;
  });
}

// ── GL Accounts ──────────────────────────────────────────────────────────────
async function syncGLAccounts() {
  const accounts = await buildium.listGLAccounts();
  const now = TS();
  clearTable("gl_accounts");
  upsertMany("gl_accounts", accounts.map((a) => ({
    id: a.Id,
    account_number: a.AccountNumber,
    name: a.Name,
    type: a.Type,
    sub_type: a.SubType,
    is_active: a.IsActive ? 1 : 0,
    synced_at: now,
  })), ["id", "account_number", "name", "type", "sub_type", "is_active", "synced_at"]);
  console.log(`[sync] GL accounts: ${accounts.length}`);
  return accounts;
}

// ── GL Entries (historical) ──────────────────────────────────────────────────
// Pulls GL report from Buildium and stores individual entries.
// The GL report endpoint returns entries grouped by GL account.
async function syncGLEntries(startdate, enddate) {
  const glAccounts = query("SELECT id, name, type FROM gl_accounts");
  if (!glAccounts.length) {
    console.warn("[sync] No GL accounts in DB — sync GL accounts first");
    return 0;
  }

  console.log(`[sync] Pulling GL entries: ${startdate} → ${enddate}`);
  const glAccountIds = glAccounts.map(a => a.id);
  const report = await buildium.getGLReport({ startdate, enddate, glaccountids: glAccountIds });
  const now = TS();
  const acctMap = new Map(glAccounts.map((a) => [a.id, a]));

  let count = 0;
  const rows = [];
  for (const item of report) {
    const acct = acctMap.get(item.GLAccountId);
    if (!acct) continue;
    const entries = item.Entries || [];
    for (const e of entries) {
      rows.push({
        id: e.Id,
        gl_account_id: item.GLAccountId,
        gl_account_name: acct.name,
        gl_account_type: acct.type,
        date: (e.Date || "").slice(0, 10),
        amount: e.Amount ?? 0,
        description: e.Description || "",
        transaction_type: e.TransactionType || "",
        synced_at: now,
      });
    }
  }

  if (rows.length) {
    upsertMany("gl_entries", rows, [
      "id", "gl_account_id", "gl_account_name", "gl_account_type",
      "date", "amount", "description", "transaction_type", "synced_at",
    ]);
    count = rows.length;
  }
  console.log(`[sync] GL entries: ${count} rows (${startdate} → ${enddate})`);
  return count;
}

// ── Backfill GL entries from account inception ───────────────────────────────
export async function backfillGL(fromYear = 2018) {
  const now = new Date();
  const currentYear = now.getFullYear();
  let totalEntries = 0;

  async function pullRange(start, end) {
    const count = await syncGLEntries(start, end);
    totalEntries += count;
    return count;
  }

  async function pullMonths(year, startMonth, endMonth) {
    for (let m = startMonth; m <= endMonth; m++) {
      const ms = `${year}-${String(m).padStart(2,'0')}-01`;
      const last = new Date(year, m, 0).getDate();
      const me = `${year}-${String(m).padStart(2,'0')}-${last}`;
      if (new Date(ms) > now) break;
      const actualEnd = new Date(me) > now ? fmtDate(now) : me;
      try { await pullRange(ms, actualEnd); }
      catch (e) { console.error(`[sync] GL ${ms}→${actualEnd} failed:`, e.message); }
    }
  }

  for (let year = fromYear; year <= currentYear; year++) {
    const start = `${year}-01-01`;
    const end = year === currentYear ? fmtDate(now) : `${year}-12-31`;
    try {
      await pullRange(start, end);
    } catch (err) {
      console.log(`[sync] Year ${year} too large, splitting into quarters...`);
      const quarters = [[1,3],[4,6],[7,9],[10,12]];
      for (const [sm, em] of quarters) {
        const qs = `${year}-${String(sm).padStart(2,'0')}-01`;
        const last = new Date(year, em, 0).getDate();
        const qe = `${year}-${String(em).padStart(2,'0')}-${last}`;
        if (new Date(qs) > now) break;
        const actualEnd = new Date(qe) > now ? fmtDate(now) : qe;
        try {
          await pullRange(qs, actualEnd);
        } catch (qerr) {
          console.log(`[sync] Quarter ${qs}→${actualEnd} too large, splitting into months...`);
          await pullMonths(year, sm, em);
        }
      }
    }
  }
  console.log(`[sync] GL backfill complete: ${totalEntries} total entries`);
  return totalEntries;
}

// ── Properties ───────────────────────────────────────────────────────────────
async function syncProperties() {
  const props = await buildium.listProperties();
  const now = TS();
  clearTable("properties");
  upsertMany("properties", props.map((p) => ({
    id: p.Id,
    name: p.Name || p.Address?.AddressLine1 || `#${p.Id}`,
    is_active: p.IsActive !== false ? 1 : 0,
    number_units: p.NumberUnits || 0,
    synced_at: now,
  })), ["id", "name", "is_active", "number_units", "synced_at"]);
  console.log(`[sync] Properties: ${props.length}`);
  return props;
}

// ── Units ────────────────────────────────────────────────────────────────────
async function syncUnits() {
  const units = await buildium.listUnits();
  const now = TS();
  clearTable("units");
  upsertMany("units", units.map((u) => ({
    id: u.Id,
    property_id: u.PropertyId,
    unit_number: u.UnitNumber || "",
    building_name: u.BuildingName || "",
    market_rent: u.MarketRent ?? null,
    is_occupied: u.IsUnitOccupied ? 1 : 0,
    is_listed: u.IsUnitListed ? 1 : 0,
    synced_at: now,
  })), ["id", "property_id", "unit_number", "building_name", "market_rent", "is_occupied", "is_listed", "synced_at"]);
  console.log(`[sync] Units: ${units.length}`);
  return units;
}

// ── Owners ───────────────────────────────────────────────────────────────────
async function syncOwners() {
  const owners = await buildium.listOwners();
  const now = TS();
  clearTable("owners");
  upsertMany("owners", owners.map((o) => ({
    id: o.Id,
    name: o.CompanyName || `${o.FirstName || ""} ${o.LastName || ""}`.trim() || "—",
    is_active: o.IsActive ? 1 : 0,
    agreement_start: o.ManagementAgreementStartDate || null,
    agreement_end: o.ManagementAgreementEndDate || null,
    property_ids: JSON.stringify(o.PropertyIds || []),
    synced_at: now,
  })), ["id", "name", "is_active", "agreement_start", "agreement_end", "property_ids", "synced_at"]);
  console.log(`[sync] Owners: ${owners.length}`);
  return owners;
}

// ── Leases ───────────────────────────────────────────────────────────────────
async function syncLeases() {
  const leases = await buildium.listAllLeases();
  const now = TS();
  clearTable("leases");
  upsertMany("leases", leases.map((l) => ({
    id: l.Id,
    unit_id: l.UnitId ?? l.Unit?.Id ?? null,
    property_id: l.PropertyId,
    status: l.LeaseStatus,
    type: l.LeaseType,
    from_date: l.LeaseFromDate || null,
    to_date: l.LeaseToDate || null,
    rent: l.AccountDetails?.Rent ?? null,
    is_eviction_pending: l.IsEvictionPending ? 1 : 0,
    synced_at: now,
  })), ["id", "unit_id", "property_id", "status", "type", "from_date", "to_date", "rent", "is_eviction_pending", "synced_at"]);
  console.log(`[sync] Leases: ${leases.length}`);
  return leases;
}

// ── Rent Schedules ───────────────────────────────────────────────────────────
async function syncRentSchedules() {
  const schedules = await buildium.listRentSchedules();
  const now = TS();
  clearTable("rent_schedules");
  upsertMany("rent_schedules", schedules.map((s) => ({
    id: s.Id,
    lease_id: s.LeaseId,
    start_date: s.StartDate || null,
    end_date: s.EndDate || null,
    total_amount: s.TotalAmount ?? 0,
    rent_cycle: s.RentCycle || "",
    synced_at: now,
  })), ["id", "lease_id", "start_date", "end_date", "total_amount", "rent_cycle", "synced_at"]);
  console.log(`[sync] Rent schedules: ${schedules.length}`);
  return schedules;
}

// ── Outstanding Balances ─────────────────────────────────────────────────────
async function syncOutstandingBalances() {
  const balances = await buildium.listOutstandingBalances();
  const now = TS();
  const today = fmtDate(new Date());
  const dayOfMonth = new Date().getUTCDate();

  // Store as a snapshot for this date
  // First remove any existing snapshot for today
  run("DELETE FROM outstanding_snapshots WHERE snapshot_date = ?", [today]);

  const rows = balances
    .filter((b) => Number(b.TotalBalance) > 0)
    .map((b) => ({
      snapshot_date: today,
      day_of_month: dayOfMonth,
      lease_id: b.LeaseId || b.Id,
      total_balance: Number(b.TotalBalance) || 0,
      balance_0_30: Number(b.Balance0To30Days) || 0,
      balance_31_60: Number(b.Balance31To60Days) || 0,
      balance_61_90: Number(b.Balance61To90Days) || 0,
      balance_over_90: Number(b.BalanceOver90Days) || 0,
    }));

  if (rows.length) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO outstanding_snapshots
        (snapshot_date, day_of_month, lease_id, total_balance,
         balance_0_30, balance_31_60, balance_61_90, balance_over_90)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction((data) => {
      for (const r of data) {
        stmt.run(
          r.snapshot_date, r.day_of_month, r.lease_id,
          r.total_balance, r.balance_0_30, r.balance_31_60,
          r.balance_61_90, r.balance_over_90
        );
      }
    });
    tx(rows);
  }

  console.log(`[sync] Outstanding balances: ${balances.length} total, ${rows.length} delinquent`);
  return balances;
}

// ── Renewal History ──────────────────────────────────────────────────────────
async function syncRenewalHistory() {
  const renewals = await buildium.listRenewalHistory({});
  const now = TS();
  clearTable("renewal_history");
  upsertMany("renewal_history", renewals.map((r) => ({
    id: r.Id,
    lease_id: r.LeaseId,
    status: r.LeaseStatus || "",
    from_date: r.LeaseFromDate || null,
    to_date: r.LeaseToDate || null,
    type: r.LeaseType || "",
    rent: r.Rent ?? null,
    created_at: r.CreatedDateTime || null,
    synced_at: now,
  })), ["id", "lease_id", "status", "from_date", "to_date", "type", "rent", "created_at", "synced_at"]);
  console.log(`[sync] Renewal history: ${renewals.length}`);
  return renewals;
}

// ── Daily Snapshot ───────────────────────────────────────────────────────────
function recordDailySnapshot(balances) {
  const today = fmtDate(new Date());
  const now = TS();

  const totalUnits = queryOne("SELECT COUNT(*) as c FROM units u JOIN properties p ON u.property_id = p.id WHERE p.is_active = 1")?.c || 0;
  const occupiedUnits = queryOne("SELECT COUNT(*) as c FROM units u JOIN properties p ON u.property_id = p.id WHERE p.is_active = 1 AND u.is_occupied = 1")?.c || 0;
  const activeLeases = queryOne("SELECT COUNT(*) as c FROM leases l JOIN units u ON l.unit_id = u.id JOIN properties p ON u.property_id = p.id WHERE l.status = 'Active' AND p.is_active = 1")?.c || 0;

  const delinquentCount = balances.filter((b) => Number(b.TotalBalance) > 0).length;
  const delinquentTotal = balances.reduce((sum, b) => sum + (Number(b.TotalBalance) > 0 ? Number(b.TotalBalance) : 0), 0);

  // Total expected rent from current rent schedules for active leases
  const rentResult = queryOne(`
    SELECT COALESCE(SUM(l.rent), 0) as total
    FROM leases l
    JOIN units u ON l.unit_id = u.id
    JOIN properties p ON u.property_id = p.id
    WHERE l.status = 'Active' AND p.is_active = 1 AND l.rent > 0
  `);
  const totalExpectedRent = rentResult?.total || 0;

  const paidLeaseCount = activeLeases - delinquentCount;

  run(`
    INSERT OR REPLACE INTO daily_snapshots
      (date, total_units, occupied_units, active_leases,
       delinquent_count, delinquent_total, total_expected_rent,
       paid_lease_count, gross_income_mtd, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `, [today, totalUnits, occupiedUnits, activeLeases,
      delinquentCount, Math.round(delinquentTotal),
      Math.round(totalExpectedRent), Math.max(paidLeaseCount, 0), now]);

  console.log(`[sync] Daily snapshot: ${totalUnits} units, ${occupiedUnits} occupied, ${delinquentCount} delinquent`);
}

// ── Full Sync ────────────────────────────────────────────────────────────────
export async function syncAll(type = "full") {
  const startedAt = TS();
  console.log(`[sync] Starting ${type} sync at ${startedAt}`);

  run("INSERT INTO sync_log (started_at, sync_type, status) VALUES (?, ?, 'running')",
    [startedAt, type]);
  const logId = queryOne("SELECT last_insert_rowid() as id")?.id;

  let totalRecords = 0;
  const errors = [];

  try {
    // 1. GL Accounts (needed first for GL entry classification)
    await syncGLAccounts().catch((e) => errors.push(`GL accounts: ${e.message}`));

    // 2. Core entities (parallel)
    const [props, units, owners, leases, rentScheds, renewals] = await Promise.all([
      safe(syncProperties(), []),
      safe(syncUnits(), []),
      safe(syncOwners(), []),
      safe(syncLeases(), []),
      safe(syncRentSchedules(), []),
      safe(syncRenewalHistory(), []),
    ]);

    // 3. Outstanding balances + daily snapshot
    const balances = await safe(syncOutstandingBalances(), []);
    recordDailySnapshot(balances);

    // 4. GL entries — incremental: only pull from the last sync forward
    const lastGLDate = queryOne("SELECT MAX(date) as d FROM gl_entries")?.d;
    const glEnd = fmtDate(new Date());
    if (!lastGLDate) {
      await backfillGL(2018);
    } else {
      // Figure out what year we left off at and backfill from there
      const lastYear = parseInt(lastGLDate.slice(0, 4));
      const currentYear = new Date().getFullYear();
      if (currentYear - lastYear > 1) {
        // Big gap — backfill remaining years
        await backfillGL(lastYear);
      } else {
        // Small gap — pull quarter by quarter
        let d = new Date(lastGLDate);
        while (d < new Date()) {
          const qs = fmtDate(d);
          d.setMonth(d.getMonth() + 3);
          const qe = d > new Date() ? glEnd : fmtDate(d);
          try { await syncGLEntries(qs, qe); } catch (e) {
            console.warn(`[sync] GL chunk ${qs}→${qe}:`, e.message);
          }
        }
      }
    }

    totalRecords = query("SELECT (SELECT COUNT(*) FROM units) + (SELECT COUNT(*) FROM leases) + (SELECT COUNT(*) FROM gl_entries) as total")[0]?.total || 0;

    const completedAt = TS();
    run("UPDATE sync_log SET completed_at = ?, status = ?, records_synced = ?, details = ? WHERE id = ?",
      [completedAt, errors.length ? "partial" : "success", totalRecords,
       errors.length ? JSON.stringify(errors) : null, logId]);

    console.log(`[sync] ${type} sync completed at ${completedAt} — ${totalRecords} records, ${errors.length} errors`);
    return { ok: true, errors, totalRecords, completedAt };
  } catch (err) {
    const completedAt = TS();
    run("UPDATE sync_log SET completed_at = ?, status = 'error', error_message = ? WHERE id = ?",
      [completedAt, err.message, logId]);
    console.error(`[sync] Fatal error:`, err);
    return { ok: false, errors: [err.message], totalRecords, completedAt };
  }
}

// ── Test GL endpoint — checks amount sign convention ─────────────────────────
export async function testGL() {
  const { query } = await import("./db.js");

  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startdate = fmtDate(lastMonth);
  const enddate = fmtDate(new Date(now.getFullYear(), now.getMonth(), 0));

  const accts = query("SELECT id, name, type, sub_type FROM gl_accounts");
  const acctIds = accts.map(a => a.id);
  const acctMap = new Map(accts.map(a => [a.id, a]));

  console.log(`[test-gl] Pulling GL report for ${startdate} → ${enddate} (${acctIds.length} accounts)`);
  const report = await buildium.getGLReport({ startdate, enddate, glaccountids: acctIds });

  return report.map((item) => {
    const acct = acctMap.get(item.GLAccountId);
    return {
      glAccountId: item.GLAccountId,
      glAccountName: item.GLAccountName,
      accountType: acct?.type || "Unknown",
      totalAmount: item.TotalAmount,
      sampleEntries: (item.Entries || []).slice(0, 3).map(e => ({
        amount: e.Amount,
        description: e.Description,
      })),
    };
  });
}

  // Cross-reference with GL accounts to show types
  const accounts = await buildium.listGLAccounts();
  const acctMap = new Map(accounts.map((a) => [a.Id, a]));


