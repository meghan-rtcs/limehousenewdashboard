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

// "% of leases paid in full by day N of the month".
// For each calendar month within the window, we take the latest snapshot whose
// dayOfMonth <= N (the closest-to-deadline observation we have for that month)
// and compute paidLeases / totalLeases. Then we average across months.
export function rentCollectedByDay(N, monthsBack = 6) {
  const entries = load();
  const now = new Date();
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1)
  );
  const byMonth = new Map();
  for (const e of entries) {
    if (!e.totalLeases || !Number.isFinite(e.paidLeases)) continue;
    if (new Date(e.ts) < cutoff) continue;
    if (e.day > N) continue;
    const key = `${e.year}-${e.month}`;
    const cur = byMonth.get(key);
    if (!cur || e.day > cur.day) byMonth.set(key, e);
  }
  if (byMonth.size === 0) return { value: 0, monthsCounted: 0, sample: 0 };
  let totalPaid = 0;
  let totalLeases = 0;
  for (const e of byMonth.values()) {
    totalPaid += e.paidLeases;
    totalLeases += e.totalLeases;
  }
  return {
    value: Math.round((totalPaid / totalLeases) * 1000) / 10,
    monthsCounted: byMonth.size,
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
    let best = null;
    for (const e of entries) {
      if (e.year !== year || e.month !== month) continue;
      if (e.day > N) continue;
      if (!e.totalLeases) continue;
      if (!best || e.day > best.day) best = e;
    }
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
