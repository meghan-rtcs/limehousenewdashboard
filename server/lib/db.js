import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "limehouse.sqlite");

let _db = null;

export function getDb() {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("busy_timeout = 5000");
  migrate(_db);
  return _db;
}

function migrate(db) {
  db.exec(`
    -- GL entries — the big historical table for income/expense
    CREATE TABLE IF NOT EXISTS gl_entries (
      id INTEGER PRIMARY KEY,
      gl_account_id INTEGER NOT NULL,
      gl_account_name TEXT,
      gl_account_type TEXT,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      transaction_type TEXT,
      synced_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_gl_date ON gl_entries(date);
    CREATE INDEX IF NOT EXISTS idx_gl_acct ON gl_entries(gl_account_id);
    CREATE INDEX IF NOT EXISTS idx_gl_type ON gl_entries(gl_account_type);

    -- GL accounts reference (parent + sub-accounts, flattened)
    CREATE TABLE IF NOT EXISTS gl_accounts (
      id INTEGER PRIMARY KEY,
      account_number TEXT,
      name TEXT,
      type TEXT,
      sub_type TEXT,
      parent_id INTEGER,
      is_active INTEGER DEFAULT 1,
      synced_at TEXT
    );

    -- Cash-basis GL entries scoped to the management Company entity only.
    -- This mirrors the Buildium "Cash Flow Statement" report and is what
    -- the income tiles + YoY chart read from. (gl_entries above is the
    -- accrual all-entities feed used elsewhere.)
    CREATE TABLE IF NOT EXISTS gl_company_cash (
      id INTEGER NOT NULL,
      gl_account_id INTEGER NOT NULL,
      gl_account_name TEXT,
      gl_account_type TEXT,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      transaction_type TEXT,
      synced_at TEXT NOT NULL,
      PRIMARY KEY (id, gl_account_id)
    );
    CREATE INDEX IF NOT EXISTS idx_gcc_date ON gl_company_cash(date);
    CREATE INDEX IF NOT EXISTS idx_gcc_type ON gl_company_cash(gl_account_type);

    -- Daily metric snapshots (for YoY + rent collection)
    CREATE TABLE IF NOT EXISTS daily_snapshots (
      date TEXT PRIMARY KEY,
      total_units INTEGER,
      occupied_units INTEGER,
      active_leases INTEGER,
      delinquent_count INTEGER,
      delinquent_total REAL,
      total_expected_rent REAL,
      paid_lease_count INTEGER,
      gross_income_mtd REAL,
      synced_at TEXT
    );

    -- Outstanding balance snapshots (per-lease, for rent collection by day)
    CREATE TABLE IF NOT EXISTS outstanding_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_date TEXT NOT NULL,
      day_of_month INTEGER NOT NULL,
      lease_id INTEGER NOT NULL,
      total_balance REAL,
      balance_0_30 REAL,
      balance_31_60 REAL,
      balance_61_90 REAL,
      balance_over_90 REAL
    );
    CREATE INDEX IF NOT EXISTS idx_ob_date ON outstanding_snapshots(snapshot_date);

    -- Leases (refreshed each sync)
    CREATE TABLE IF NOT EXISTS leases (
      id INTEGER PRIMARY KEY,
      unit_id INTEGER,
      property_id INTEGER,
      status TEXT,
      type TEXT,
      from_date TEXT,
      to_date TEXT,
      rent REAL,
      is_eviction_pending INTEGER DEFAULT 0,
      synced_at TEXT
    );

    -- Per-tenant move-in/move-out dates per lease (refreshed alongside leases
    -- every sync, from the same Buildium listAllLeases() response — no extra
    -- live call). Feeds the tenancy-length calc (renewal-chaining needs the
    -- tenant's FIRST move-in across every lease they appear on for a unit;
    -- move_in_date is stored pre-resolved with the "tenant MoveInDate, else
    -- lease LeaseFromDate" fallback already applied, same as the old live
    -- code did inline). move_out_date stays NULL for tenants still in place.
    CREATE TABLE IF NOT EXISTS lease_tenants (
      lease_id INTEGER NOT NULL,
      tenant_id INTEGER NOT NULL,
      move_in_date TEXT,
      move_out_date TEXT,
      PRIMARY KEY (lease_id, tenant_id)
    );
    CREATE INDEX IF NOT EXISTS idx_lease_tenants_tenant ON lease_tenants(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_lease_tenants_moveout ON lease_tenants(move_out_date);

    -- Rent schedules (refreshed each sync)
    CREATE TABLE IF NOT EXISTS rent_schedules (
      id INTEGER PRIMARY KEY,
      lease_id INTEGER NOT NULL,
      start_date TEXT,
      end_date TEXT,
      total_amount REAL,
      rent_cycle TEXT,
      synced_at TEXT
    );

    -- Units (refreshed each sync)
    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY,
      property_id INTEGER,
      unit_number TEXT,
      building_name TEXT,
      market_rent REAL,
      is_occupied INTEGER,
      is_listed INTEGER,
      synced_at TEXT
    );

    -- Properties (refreshed each sync)
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY,
      name TEXT,
      is_active INTEGER DEFAULT 1,
      number_units INTEGER,
      synced_at TEXT
    );

    -- Owners (refreshed each sync)
    CREATE TABLE IF NOT EXISTS owners (
      id INTEGER PRIMARY KEY,
      name TEXT,
      is_active INTEGER DEFAULT 1,
      agreement_start TEXT,
      agreement_end TEXT,
      property_ids TEXT,
      synced_at TEXT
    );

    -- Renewal history
    CREATE TABLE IF NOT EXISTS renewal_history (
      id INTEGER PRIMARY KEY,
      lease_id INTEGER,
      status TEXT,
      from_date TEXT,
      to_date TEXT,
      type TEXT,
      rent REAL,
      created_at TEXT,
      synced_at TEXT
    );

    -- Tenants
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      lease_id INTEGER,
      synced_at TEXT
    );

    -- Daily property roster snapshots (one row per active property per UTC day).
    -- Used to compute doors gained/lost by diffing today's roster against the
    -- oldest snapshot in the trailing 12 months. PK on (snapshot_date,
    -- property_id) so re-running the snapshot in the same day is a no-op.
    CREATE TABLE IF NOT EXISTS property_snapshots (
      snapshot_date TEXT NOT NULL,
      property_id INTEGER NOT NULL,
      name TEXT,
      unit_count INTEGER,
      PRIMARY KEY (snapshot_date, property_id)
    );
    CREATE INDEX IF NOT EXISTS idx_property_snapshots_date ON property_snapshots(snapshot_date);

    -- Team performance quarterly snapshots. One row per (year, quarter),
    -- upserted on every refresh. The current quarter's row updates live as
    -- data changes; once the calendar rolls into the next quarter the old row
    -- is never touched again, freezing it as that quarter's final standing.
    -- payload is a compact JSON blob of per-role scorePct/bonus and per-KPI
    -- actual/score/tier, used to chart quarter-over-quarter trend.
    CREATE TABLE IF NOT EXISTS team_perf_snapshots (
      year INTEGER NOT NULL,
      quarter INTEGER NOT NULL,
      captured_at TEXT,
      payload TEXT,
      PRIMARY KEY (year, quarter)
    );

    -- Generic key/value cache. Used to persist the last fully-built dashboard
    -- payload so a cold start (deploy / idle wake) can serve the previous
    -- snapshot instantly while a fresh build runs in the background, instead
    -- of blocking the first request on a ~80s live rebuild.
    CREATE TABLE IF NOT EXISTS app_cache (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    );

    -- Applications (refreshed each sync) — Buildium's /v1/applicants
    -- endpoint takes no date params, so this is a full re-pull every sync;
    -- one row per Applications[] entry per applicant (an applicant can have
    -- multiple applications). submitted_at drives the windowed
    -- "applications submitted" flow metric.
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY,
      applicant_id INTEGER,
      applicant_first_name TEXT,
      applicant_last_name TEXT,
      application_number TEXT,
      status TEXT,
      submitted_at TEXT,
      synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_applications_submitted ON applications(submitted_at);

    -- Vendors (refreshed each sync) — structural snapshot, no history.
    -- Tax/insurance fields are coalesced once here from Buildium's 3
    -- possible nesting paths (TaxInformation / VendorTaxInformation /
    -- VendorMessage.TaxInformation, similarly for VendorInsurance) so the
    -- dashboard build no longer has to repeat that fallback chain.
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY,
      name TEXT,
      is_active INTEGER DEFAULT 1,
      category_name TEXT,
      tax_payer_id TEXT,
      tax_payer_id_type TEXT,
      include_in_1099 INTEGER DEFAULT 0,
      insurance_expiration_date TEXT,
      synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(category_name);

    -- Bank accounts (refreshed each sync) — structural snapshot, no history.
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id INTEGER PRIMARY KEY,
      name TEXT,
      gl_account_name TEXT,
      gl_account_is_active INTEGER DEFAULT 1,
      balance REAL,
      is_active INTEGER DEFAULT 1,
      synced_at TEXT
    );

    -- Bank reconciliations — raw rows, keyed by Buildium's own reconciliation
    -- Id (same convention as every other Buildium-backed table here), so
    -- INSERT OR REPLACE naturally captures an IsFinished flip on a
    -- previously-open statement when re-synced. Buildium's reconciliations
    -- endpoint takes no date params (full history per call), so this is a
    -- full re-pull every sync. This table replacing the old per-request live
    -- call is the fix for the 429 incident.
    CREATE TABLE IF NOT EXISTS reconciliations (
      id INTEGER PRIMARY KEY,
      bank_account_id INTEGER NOT NULL,
      statement_ending_date TEXT,
      is_finished INTEGER DEFAULT 0,
      synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_recon_bank_date ON reconciliations(bank_account_id, statement_ending_date);

    -- RentEngine prospects — raw rows, windowed by created_at. RentEngine
    -- data for this account only goes back to ~Feb 2026 (confirmed via an
    -- exploratory unbounded call), so backfill is small — no month-by-month
    -- chunking needed, a single wide-range call covers all history.
    CREATE TABLE IF NOT EXISTS re_prospects (
      id INTEGER PRIMARY KEY,
      name TEXT,
      source TEXT,
      created_at TEXT NOT NULL,
      synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_re_prospects_created ON re_prospects(created_at);

    -- Lease transactions — raw rows, consolidates what used to be 2
    -- separate live buildium.leaseTransactions() call sites (security-deposit
    -- withholding calc + rent-processing accuracy calc) into 1 synced table.
    -- Buildium's endpoint takes no date params (full history per lease per
    -- call), so syncLeaseTransactions() bounds what it UPSERTS to a trailing
    -- window rather than storing everything forever. "type" is pre-resolved
    -- from TransactionTypeEnum||TransactionType at sync time; memo and
    -- journal_memo are kept as 2 separate columns because the two
    -- consumers check different combinations of them (SD calc: journal_memo
    -- only; rent-processing NSF calc: memo+journal_memo concatenated) — do
    -- not collapse these into one column.
    CREATE TABLE IF NOT EXISTS lease_transactions (
      id INTEGER PRIMARY KEY,
      lease_id INTEGER NOT NULL,
      date TEXT,
      type TEXT,
      memo TEXT,
      journal_memo TEXT,
      amount REAL,
      synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_lease_txn_lease ON lease_transactions(lease_id);
    CREATE INDEX IF NOT EXISTS idx_lease_txn_date ON lease_transactions(date);

    -- RentEngine showings — raw rows, windowed by created_at (confirmed via
    -- an exploratory call that real rows never populate scheduled_at/
    -- started_at — the aggregator's existing fallback chain already falls
    -- through to created_at in practice; both columns are kept only for
    -- forward-compat with that fallback expression). PK is RentEngine's own
    -- showing_id field (confirmed stable/unique), NOT a generic "id".
    CREATE TABLE IF NOT EXISTS re_showings (
      id INTEGER PRIMARY KEY,
      property_address TEXT,
      status TEXT,
      scheduled_at TEXT,
      started_at TEXT,
      created_at TEXT,
      synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_re_showings_date ON re_showings(created_at);

    -- RentEngine per-unit structural status (days_on_market, property_health)
    -- — as-of-today, NOT windowed, so this is a plain latest-known snapshot
    -- (one row per unit, overwritten every sync), refreshed alongside the
    -- current-month bucket below.
    CREATE TABLE IF NOT EXISTS re_unit_status (
      unit_id INTEGER PRIMARY KEY,
      days_on_market INTEGER,
      property_health TEXT,
      synced_at TEXT
    );

    -- RentEngine per-unit monthly performance buckets (calls, texts) — the
    -- only metric in this file where the source API itself is
    -- range-aggregated, not row-level, so arbitrary filter windows are
    -- reconstructed by SUMming whichever (year,month) buckets overlap the
    -- requested window. Complete past months are immutable once captured
    -- (backfillReUnitPerf); the current month's row is refreshed every sync
    -- since it's still accumulating (syncReUnitPerf) — same
    -- "accumulate current period, freeze past periods" invariant as
    -- team_perf_snapshots. applications_requested/applications_submitted
    -- from this endpoint are confirmed dead downstream — not stored.
    CREATE TABLE IF NOT EXISTS re_unit_monthly_perf (
      unit_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      total_calls INTEGER DEFAULT 0,
      outbound_texts INTEGER DEFAULT 0,
      synced_at TEXT,
      PRIMARY KEY (unit_id, year, month)
    );
    CREATE INDEX IF NOT EXISTS idx_re_unit_perf_ym ON re_unit_monthly_perf(year, month);

    -- RentEngine units (refreshed each sync) — structural snapshot, no
    -- history needed. account_id/showing_method/status drive the showings
    -- completion split and the on-market/health tiles.
    CREATE TABLE IF NOT EXISTS re_units (
      id INTEGER PRIMARY KEY,
      account_id INTEGER,
      formatted_address TEXT,
      showing_method TEXT,
      status TEXT,
      created_at TEXT,
      synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_re_units_account ON re_units(account_id);

    -- Sync log
    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT,
      completed_at TEXT,
      sync_type TEXT,
      status TEXT,
      error_message TEXT,
      records_synced INTEGER DEFAULT 0,
      details TEXT
    );
  `);

  // Idempotent column adds for existing DBs
  const cols = db.prepare("PRAGMA table_info(gl_accounts)").all().map(c => c.name);
  if (!cols.includes("parent_id")) {
    db.exec("ALTER TABLE gl_accounts ADD COLUMN parent_id INTEGER");
  }
  const leaseCols = db.prepare("PRAGMA table_info(leases)").all().map(c => c.name);
  if (!leaseCols.includes("security_deposit")) {
    db.exec("ALTER TABLE leases ADD COLUMN security_deposit REAL");
  }
}

// ── Helper functions ─────────────────────────────────────────────────────────

export function upsertMany(table, rows, columns) {
  if (!rows.length) return 0;
  const db = getDb();
  const placeholders = columns.map(() => "?").join(", ");
  const cols = columns.join(", ");
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO ${table} (${cols}) VALUES (${placeholders})`
  );
  const tx = db.transaction((data) => {
    let count = 0;
    for (const row of data) {
      stmt.run(...columns.map((c) => row[c] ?? null));
      count++;
    }
    return count;
  });
  return tx(rows);
}

export function clearTable(table) {
  getDb().exec(`DELETE FROM ${table}`);
}

// Atomically replace a table's entire contents: deletes existing rows and
// inserts the new ones inside a single transaction, so an interruption can
// never leave the table empty or half-populated.
export function replaceTable(table, rows, columns) {
  const db = getDb();
  const placeholders = columns.map(() => "?").join(", ");
  const cols = columns.join(", ");
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO ${table} (${cols}) VALUES (${placeholders})`
  );
  const tx = db.transaction((data) => {
    db.exec(`DELETE FROM ${table}`);
    let count = 0;
    for (const row of data) {
      stmt.run(...columns.map((c) => row[c] ?? null));
      count++;
    }
    return count;
  });
  return tx(rows);
}

export function query(sql, params = []) {
  return getDb().prepare(sql).all(...params);
}

export function queryOne(sql, params = []) {
  return getDb().prepare(sql).get(...params);
}

export function run(sql, params = []) {
  return getDb().prepare(sql).run(...params);
}
