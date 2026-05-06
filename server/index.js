import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getDb, query as dbQuery } from "./lib/db.js";
import { syncAll, testGL } from "./lib/sync.js";
import { buildDashboard } from "./lib/aggregator.js";
import { startScheduler, runSync } from "./lib/scheduler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_ROOT = path.join(__dirname, "..", "Limehouse Revamp");
const PORT = Number(process.env.PORT || 5000);

// Initialize database on startup
getDb();

const app = express();
app.disable("etag");
app.use((req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
app.use(express.json());

// ── Dashboard data ───────────────────────────────────────────────────────────
let cachedPayload = null;
let cachedAt = null;
let building = false;

async function refreshDashboard() {
  if (building) return;
  building = true;
  try {
    cachedPayload = await buildDashboard();
    cachedAt = Date.now();
    console.log(`[server] Dashboard built at ${new Date(cachedAt).toISOString()}`);
  } catch (err) {
    console.error("[server] Dashboard build error:", err);
  } finally {
    building = false;
  }
}

app.get("/api/dashboard", async (req, res) => {
  if (!cachedPayload) {
    // Try to build from DB data if available
    try {
      await refreshDashboard();
    } catch (e) { /* ignore */ }
  }
  if (!cachedPayload) {
    res.status(503).json({ error: "Data not yet loaded. Run a sync first.", fetching: building });
    return;
  }
  res.json({
    ...cachedPayload,
    sync: { fetchedAt: cachedAt, isStale: cachedAt ? Date.now() - cachedAt > 600000 : true },
  });
});

// ── Sync trigger ─────────────────────────────────────────────────────────────
app.post("/api/sync", async (req, res) => {
  try {
    const result = await syncAll("manual");
    // Rebuild dashboard after sync
    await refreshDashboard();
    res.json({ ok: result.ok, errors: result.errors, records: result.totalRecords });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Sync status ──────────────────────────────────────────────────────────────
app.get("/api/sync-status", (req, res) => {
  try {
    const lastSync = dbQuery("SELECT * FROM sync_log ORDER BY id DESC LIMIT 1")[0];
    const entryCount = dbQuery("SELECT COUNT(*) as c FROM gl_entries")[0]?.c || 0;
    const unitCount = dbQuery("SELECT COUNT(*) as c FROM units")[0]?.c || 0;
    res.json({ lastSync, glEntries: entryCount, units: unitCount, dashboardCachedAt: cachedAt, dashboardBuilding: building });
  } catch (err) {
    res.json({ error: err.message, dashboardCachedAt: cachedAt, dashboardBuilding: building });
  }
});

// ── GL Test Endpoint (Option A: GL Report) ───────────────────────────────────
// Run this once to check whether income amounts are positive or negative.
// Look at the "accountType: Income" entries and check if TotalAmount/sampleEntries
// amounts are positive or negative. This determines the NEGATE_INCOME flag.
app.get("/api/test-gl", async (req, res) => {
  try {
    const result = await testGL();
    res.json({
      instruction: "Look at entries where accountType = 'Income'. If amounts are NEGATIVE, keep NEGATE_INCOME = true in aggregator.js. If POSITIVE, set it to false.",
      data: result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Sync log ─────────────────────────────────────────────────────────────────
app.get("/api/sync-log", (req, res) => {
  try { res.json(dbQuery("SELECT * FROM sync_log ORDER BY id DESC LIMIT 20")); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Static files ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(STATIC_ROOT, "Limehouse Dashboard - A.html"));
});
app.use(express.static(STATIC_ROOT, { etag: false, lastModified: false }));

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`[server] Listening on http://0.0.0.0:${PORT}`);
  console.log(`[server] Static root: ${STATIC_ROOT}`);

  // Start the cron scheduler
  startScheduler();

  // Initial sync + dashboard build
  console.log("[server] Starting initial sync...");
  try {
    await syncAll("full");
    await refreshDashboard();
    console.log("[server] Initial sync and dashboard build complete");
  } catch (err) {
    console.error("[server] Initial sync failed:", err.message);
    // Try to build dashboard from whatever data is in DB
    try { await refreshDashboard(); } catch (e) { /* ignore */ }
  }
});
