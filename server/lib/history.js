import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "sync-history.json");
const MAX_ENTRIES = 5000;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(FILE)) return [];
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("[history] load failed:", err.message);
    return [];
  }
}

function save(entries) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(entries, null, 2));
}

export function recordSnapshot(snapshot) {
  const entries = load();
  const ts = snapshot.ts || new Date().toISOString();
  const dt = new Date(ts);
  const day = dt.getUTCDate();
  const month = dt.getUTCMonth();
  const year = dt.getUTCFullYear();
  const entry = { ts, year, month, day, ...snapshot };
  // One snapshot per (year, month, day) — keep the latest for that date
  const sameDayIdx = entries.findIndex(
    (e) => e.year === year && e.month === month && e.day === day
  );
  if (sameDayIdx >= 0) entries[sameDayIdx] = entry;
  else entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  save(entries);
  return entries;
}

export function getHistory() {
  return load();
}

// Grace window after the target day. A snapshot taken on day D measures
// "% paid by day D"; we need D >= N (so day N has actually elapsed) and
// allow D up to N + GRACE so a snapshot a few days later still counts as
// the "by day N" observation if no exact-day snapshot exists.
const GRACE_DAYS = 5;

function bestSnapshotForMonth(entries, year, month, N) {
  let best = null;
  for (const e of entries) {
    if (e.year !== year || e.month !== month) continue;
    if (!e.totalLeases || !Number.isFinite(e.paidLeases)) continue;
    if (e.day < N || e.day > N + GRACE_DAYS) continue;
    // Prefer the snapshot taken closest to (and not before) day N.
    if (!best || e.day < best.day) best = e;
  }
  return best;
}

// "% of leases paid in full by day N of the month".
// For each calendar month within the window, we take the snapshot taken on
// day N (or within GRACE_DAYS after) and compute paidLeases / totalLeases.
// Then we average across months that have such a snapshot.
export function rentCollectedByDay(N, monthsBack = 6) {
  const entries = load();
  const now = new Date();
  const months = [];
  for (let i = 0; i < monthsBack; i++) {
    const target = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)
    );
    months.push({ year: target.getUTCFullYear(), month: target.getUTCMonth() });
  }
  let totalPaid = 0;
  let totalLeases = 0;
  let monthsCounted = 0;
  for (const { year, month } of months) {
    const best = bestSnapshotForMonth(entries, year, month, N);
    if (!best) continue;
    totalPaid += best.paidLeases;
    totalLeases += best.totalLeases;
    monthsCounted += 1;
  }
  if (!monthsCounted || !totalLeases)
    return { value: 0, monthsCounted: 0, sample: 0 };
  return {
    value: Math.round((totalPaid / totalLeases) * 1000) / 10,
    monthsCounted,
    sample: totalLeases,
  };
}

// Per-month series: for each of the last `monthsBack` months, return the
// best snapshot for "by day N" so the UI can chart it.
export function rentCollectedSeries(N, monthsBack = 12) {
  const entries = load();
  const now = new Date();
  const out = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const target = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)
    );
    const month = target.getUTCMonth();
    const year = target.getUTCFullYear();
    const best = bestSnapshotForMonth(entries, year, month, N);
    out.push({
      year,
      month,
      pct: best
        ? Math.round((best.paidLeases / best.totalLeases) * 1000) / 10
        : 0,
      hasData: !!best,
    });
  }
  return out;
}
