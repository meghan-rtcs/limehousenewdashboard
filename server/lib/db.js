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

    -- GL accounts reference
    CREATE TABLE IF NOT EXISTS gl_accounts (
      id INTEGER PRIMARY KEY,
      account_number TEXT,
      name TEXT,
      type TEXT,
      sub_type TEXT,
      is_active INTEGER DEFAULT 1,
      synced_at TEXT
    );

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

export function query(sql, params = []) {
  return getDb().prepare(sql).all(...params);
}

export function queryOne(sql, params = []) {
  return getDb().prepare(sql).get(...params);
}

export function run(sql, params = []) {
  return getDb().prepare(sql).run(...params);
}
