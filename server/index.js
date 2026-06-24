import express from "express";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { getDb, query as dbQuery, run as dbRun, queryOne as dbQueryOne } from "./lib/db.js";
import { syncAll, testGL } from "./lib/sync.js";
import { buildDashboard, periodToWindow, PERIOD_KEYS } from "./lib/aggregator.js";
import { startScheduler, runSync, runLeadSimpleSync, setPostSyncHook } from "./lib/scheduler.js";
import { buildium } from "./lib/buildium.js";
import { getBundle, warmBundle } from "./lib/bundle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_ROOT = path.join(__dirname, "..", "Limehouse Revamp");
const PORT = Number(process.env.PORT || 5000);

// Initialize database on startup
getDb();
import { migrateLeadSimple } from "./lib/ls-sync.js";
migrateLeadSimple();

const app = express();
app.disable("etag");
app.use((req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Password protection ──────────────────────────────────────────────────────
// Single shared password (env DASHBOARD_PASSWORD) gates the whole dashboard.
// Cookie-session login page rather than HTTP Basic Auth because the Replit
// preview runs in a cross-site iframe where native Basic Auth prompts are
// blocked. The session cookie is SameSite=None; Secure so it is sent inside
// that cross-site iframe. The cookie stores an HMAC of a fixed string keyed by
// the password — never the password itself.
const AUTH_PASSWORD = process.env.DASHBOARD_PASSWORD || "";
const AUTH_COOKIE = "limehouse_auth";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days (seconds)

function authToken() {
  return crypto.createHmac("sha256", AUTH_PASSWORD || "unset")
    .update("limehouse-session-v1").digest("hex");
}
function parseCookies(header) {
  const out = {};
  (header || "").split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}
function timingSafeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
function isAuthed(req) {
  if (!AUTH_PASSWORD) return false; // not configured → fail closed (deny) rather than expose data
  const cookies = parseCookies(req.headers.cookie);
  return cookies[AUTH_COOKIE] ? timingSafeEqual(cookies[AUTH_COOKIE], authToken()) : false;
}

// CSRF defense for state-changing requests. The session cookie is SameSite=None
// (required for the cross-site preview iframe), so a custom header is required
// on mutating requests: a cross-origin attacker cannot set custom headers
// without triggering a CORS preflight, which this server never approves.
function csrfOk(req) {
  return req.get("X-Requested-With") === "LimehouseDashboard";
}

function loginPage(showError) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Limehouse · Sign in</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    background: #f4f6f1; color: #1c2119; }
  .card { width: 100%; max-width: 360px; background: #fff; border: 1px solid #e2e6dc;
    border-radius: 14px; padding: 32px 28px; box-shadow: 0 8px 30px rgba(28,33,25,.06); }
  h1 { font-size: 19px; margin: 0 0 4px; }
  p.sub { margin: 0 0 22px; color: #6a766a; font-size: 13px; }
  label { display: block; font-size: 12px; font-weight: 600; color: #44503f; margin-bottom: 6px; }
  input { width: 100%; padding: 11px 12px; font-size: 15px; border: 1px solid #ccd3c6;
    border-radius: 9px; outline: none; background: #fbfcfa; }
  input:focus { border-color: #6f8f5f; box-shadow: 0 0 0 3px rgba(111,143,95,.18); }
  button { width: 100%; margin-top: 18px; padding: 11px 12px; font-size: 15px; font-weight: 600;
    color: #fff; background: #4f6b3f; border: 0; border-radius: 9px; cursor: pointer; }
  button:hover { background: #44602f; }
  .err { margin-top: 14px; font-size: 13px; color: #a3331f; background: #fbeae6;
    border: 1px solid #f0c8bf; border-radius: 8px; padding: 8px 11px; }
</style></head><body>
  <form class="card" method="POST" action="/login">
    <h1>Limehouse Dashboard</h1>
    <p class="sub">Enter the password to continue.</p>
    <input type="text" name="username" autocomplete="username" value="limehouse" hidden aria-hidden="true">
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" autofocus required>
    ${showError ? `<div class="err">Incorrect password. Please try again.</div>` : ""}
    <button type="submit">Sign in</button>
  </form>
</body></html>`;
}

// Lightweight in-memory login throttle: max 10 failed attempts per IP per
// 15-minute window. Successful logins reset the counter.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILS = 10;
const loginAttempts = new Map(); // ip -> { count, resetAt }
function loginThrottle(ip) {
  const now = Date.now();
  let rec = loginAttempts.get(ip);
  if (!rec || now > rec.resetAt) { rec = { count: 0, resetAt: now + LOGIN_WINDOW_MS }; loginAttempts.set(ip, rec); }
  return rec;
}

app.get("/login", (req, res) => {
  if (isAuthed(req)) return res.redirect("/");
  res.type("html").send(loginPage(false));
});
app.post("/login", (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const rec = loginThrottle(ip);
  if (rec.count >= LOGIN_MAX_FAILS) {
    return res.status(429).type("html").send(loginPage(true));
  }
  const pw = (req.body && req.body.password) || "";
  if (AUTH_PASSWORD && timingSafeEqual(pw, AUTH_PASSWORD)) {
    loginAttempts.delete(ip);
    res.setHeader("Set-Cookie",
      `${AUTH_COOKIE}=${authToken()}; HttpOnly; Path=/; Max-Age=${SESSION_MAX_AGE}; SameSite=None; Secure`);
    return res.redirect("/");
  }
  rec.count++;
  res.status(401).type("html").send(loginPage(true));
});
app.post("/logout", (req, res) => {
  res.setHeader("Set-Cookie", `${AUTH_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=None; Secure`);
  res.redirect("/login");
});

// Gate everything below this point.
app.use((req, res, next) => {
  if (isAuthed(req)) return next();
  if (req.path.startsWith("/api/")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.redirect("/login");
});
if (!AUTH_PASSWORD) {
  console.warn("[server] DASHBOARD_PASSWORD is not set — login gate is fail-closed, so ALL routes are denied until the secret is set.");
}

// ── Dashboard data ───────────────────────────────────────────────────────────
// One cache entry per reporting period (currentMonth, lastMonth, …). The
// default period is built at startup; the rest are built lazily on first
// request and refreshed in the background when stale (10-min TTL).
const DEFAULT_PERIOD = "currentMonth";
const TTL_MS = 600000;
const periodCache = new Map(); // periodKey -> { payload, builtAt, building, rebuildPending }

function getEntry(period) {
  let e = periodCache.get(period);
  if (!e) {
    e = { payload: null, builtAt: null, building: false, rebuildPending: false };
    periodCache.set(period, e);
  }
  return e;
}

async function refreshDashboard(period = DEFAULT_PERIOD) {
  const e = getEntry(period);
  // If a build is already running for this period, mark that another rebuild is
  // needed and return. The in-flight build re-runs once on completion so a
  // refresh requested mid-build still picks up the latest DB state.
  if (e.building) {
    e.rebuildPending = true;
    return;
  }
  e.building = true;
  try {
    do {
      e.rebuildPending = false;
      e.payload = await buildDashboard(periodToWindow(period, new Date()));
      e.builtAt = Date.now();
      persistDashboard(period, e.payload, e.builtAt);
      console.log(`[server] Dashboard (${period}) built at ${new Date(e.builtAt).toISOString()}`);
    } while (e.rebuildPending);
  } catch (err) {
    console.error(`[server] Dashboard build error (${period}):`, err);
  } finally {
    e.building = false;
  }
}

// Rebuild every period currently in the cache (used after a sync). Always
// includes the default period even if it hasn't been requested yet.
async function refreshAllDashboards() {
  const periods = new Set([DEFAULT_PERIOD, ...periodCache.keys()]);
  for (const p of periods) await refreshDashboard(p);
}

// Persist the freshly-built payload so the next cold start can serve it
// immediately. Best-effort: a persistence failure must never break a build.
function persistDashboard(period, payload, builtAt) {
  try {
    dbRun(
      `INSERT INTO app_cache (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [`dashboard:${period}`, JSON.stringify({ payload, builtAt }), new Date(builtAt).toISOString()]
    );
  } catch (e) {
    console.error("[server] persist dashboard failed:", e.message);
  }
}

// Load the last persisted payload for a period into memory so /api/dashboard
// answers instantly on startup. Returns true if a snapshot was loaded.
function loadPersistedDashboard(period = DEFAULT_PERIOD) {
  try {
    const row = dbQueryOne("SELECT value FROM app_cache WHERE key = ?", [`dashboard:${period}`]);
    if (!row?.value) return false;
    const parsed = JSON.parse(row.value);
    if (parsed?.payload) {
      const e = getEntry(period);
      e.payload = parsed.payload;
      e.builtAt = parsed.builtAt || Date.now();
      console.log(`[server] Loaded persisted dashboard (${period}) from ${new Date(e.builtAt).toISOString()}`);
      return true;
    }
  } catch (e) {
    console.error("[server] load persisted dashboard failed:", e.message);
  }
  return false;
}

// Let scheduled syncs (Buildium + overnight LeadSimple) rebuild every cached
// dashboard period once their DB writes complete.
setPostSyncHook(refreshAllDashboards);

app.get("/api/dashboard", async (req, res) => {
  const period = PERIOD_KEYS.includes(req.query.period) ? req.query.period : DEFAULT_PERIOD;
  const e = getEntry(period);
  if (!e.payload) {
    // First request for this period: build it synchronously from DB data.
    try { await refreshDashboard(period); } catch (err) { /* ignore */ }
  } else if (e.builtAt && Date.now() - e.builtAt > TTL_MS && !e.building) {
    // Stale: serve the existing payload now, refresh in the background.
    refreshDashboard(period);
  }
  if (!e.payload) {
    res.status(503).json({ error: "Data not yet loaded. Run a sync first.", fetching: e.building });
    return;
  }
  res.json({
    ...e.payload,
    sync: { fetchedAt: e.builtAt, isStale: e.builtAt ? Date.now() - e.builtAt > TTL_MS : true },
  });
});

// ── Sync trigger ─────────────────────────────────────────────────────────────
app.post("/api/sync", async (req, res) => {
  if (!csrfOk(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const result = await syncAll("manual");
    // Rebuild every cached dashboard period after sync
    await refreshAllDashboards();
    res.json({ ok: result.ok, errors: result.errors, records: result.totalRecords });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── LeadSimple sync (slow / rate-limited; runs in background) ─────────────────
// Kicks off the LeadSimple pull without blocking the request. The pull paces
// itself around LeadSimple's per-window record rate limit (can take several
// minutes), persists to SQLite, and the dashboard reads the last snapshot.
app.post("/api/sync-leadsimple", (req, res) => {
  if (!csrfOk(req)) return res.status(403).json({ error: "Forbidden" });
  runLeadSimpleSync(); // fire-and-forget; guarded against concurrent runs
  res.json({ ok: true, started: true, note: "LeadSimple sync started in background; this can take several minutes due to rate limits." });
});

app.get("/api/leadsimple-status", (req, res) => {
  try {
    const tasks = dbQuery("SELECT COUNT(*) AS total, SUM(completed_at IS NOT NULL) AS completed FROM ls_tasks")[0] || {};
    const processes = dbQuery("SELECT COUNT(*) AS c FROM ls_processes")[0]?.c || 0;
    const lastSynced = dbQuery("SELECT MAX(synced_at) AS at FROM ls_tasks")[0]?.at || null;
    res.json({ tasks: tasks.total || 0, completedTasks: tasks.completed || 0, processes, lastSynced });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Sync status ──────────────────────────────────────────────────────────────
app.get("/api/sync-status", (req, res) => {
  try {
    const lastSync = dbQuery("SELECT * FROM sync_log ORDER BY id DESC LIMIT 1")[0];
    const entryCount = dbQuery("SELECT COUNT(*) as c FROM gl_entries")[0]?.c || 0;
    const unitCount = dbQuery("SELECT COUNT(*) as c FROM units")[0]?.c || 0;
    const e = getEntry(DEFAULT_PERIOD);
    res.json({ lastSync, glEntries: entryCount, units: unitCount, dashboardCachedAt: e.builtAt, dashboardBuilding: e.building });
  } catch (err) {
    const e = getEntry(DEFAULT_PERIOD);
    res.json({ error: err.message, dashboardCachedAt: e.builtAt, dashboardBuilding: e.building });
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

// ── Debug: Buildium users + roles ────────────────────────────────────────────
function esc(s) {
  if (s === null || s === undefined || s === "") return "—";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

app.get("/debug/buildium-users", async (req, res) => {
  try {
    const [roles, users] = await Promise.all([
      buildium.listUserRoles(),
      buildium.listUsers(),
    ]);

    // Build role lookup
    const roleById = new Map();
    for (const r of roles) {
      const id = pick(r, "Id", "id");
      if (id !== undefined) roleById.set(id, r);
    }

    // Filter to staff users
    const isStaff = (u) => {
      const t = pick(u, "UserTypes", "userTypes", "UserType", "userType");
      if (!t) return false;
      const arr = Array.isArray(t) ? t : [t];
      return arr.some((x) => String(x).toLowerCase().includes("staff"));
    };
    const staffList = users.filter(isStaff);

    // The /v1/users list endpoint does NOT include role assignments.
    // Hydrate each staff user with /v1/users/{id} which returns UserRole.
    async function hydrate(u) {
      try {
        const d = await buildium.raw(`/users/${u.Id}`);
        return { ...u, ...d };
      } catch (e) {
        return { ...u, _hydrateError: e.message };
      }
    }
    const CONCURRENCY = 5;
    const staff = [];
    for (let i = 0; i < staffList.length; i += CONCURRENCY) {
      const batch = await Promise.all(staffList.slice(i, i + CONCURRENCY).map(hydrate));
      staff.push(...batch);
    }

    // Count users per role (using hydrated UserRole)
    const userCountByRole = new Map();
    for (const u of staff) {
      const roleId = u.UserRole?.Id;
      if (roleId !== undefined && roleId !== null) {
        userCountByRole.set(roleId, (userCountByRole.get(roleId) || 0) + 1);
      }
    }

    // ── Roles table
    const rolesRows = roles.map((r) => {
      const id = pick(r, "Id", "id");
      const name = pick(r, "Name", "name");
      const desc = pick(r, "Description", "description");
      return `<tr>
        <td>${esc(id)}</td>
        <td>${esc(name)}</td>
        <td>${esc(desc)}</td>
        <td style="text-align:right">${userCountByRole.get(id) || 0}</td>
      </tr>`;
    }).join("");

    // ── Staff users table
    const staffRows = staff.map((u) => {
      const id = pick(u, "Id", "id");
      const first = pick(u, "FirstName", "firstName") || "";
      const last = pick(u, "LastName", "lastName") || "";
      const full = pick(u, "FullName", "fullName") || `${first} ${last}`.trim();
      const email = pick(u, "Email", "email");
      const types = pick(u, "UserTypes", "userTypes", "UserType", "userType");
      const typesStr = Array.isArray(types) ? types.join(", ") : (types || "");
      const roleId = u.UserRole?.Id;
      const roleName = u.UserRole?.Name || roleById.get(roleId)?.Name || "";
      const lastLogin = pick(u, "LastLogin", "LastLoginDateTime", "lastLoginDateTime");
      return `<tr>
        <td>${esc(id)}</td>
        <td>${esc(full)}</td>
        <td>${esc(email)}</td>
        <td>${esc(typesStr)}</td>
        <td>${esc(roleName)}</td>
        <td>${esc(roleId)}</td>
        <td>${esc(lastLogin)}</td>
      </tr>`;
    }).join("");

    const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Buildium Users & Roles (debug)</title>
<style>
  body { font: 13px/1.4 -apple-system, system-ui, sans-serif; margin: 24px; color: #1c2119; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 28px 0 8px; }
  .meta { color: #6a766a; font-size: 12px; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid #d8dcd2; padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: #f4f6f1; font-weight: 600; }
  tr:nth-child(even) td { background: #fafbf8; }
  code { background: #f4f6f1; padding: 1px 5px; border-radius: 3px; }
</style></head><body>
<h1>Buildium Users &amp; Roles — debug</h1>
<div class="meta">
  Pulled live from Buildium API at ${new Date().toISOString()}.
  <code>GET /v1/userroles</code> · <code>GET /v1/users?status=Active</code>
</div>

<h2>Section 1 · User Roles (${roles.length})</h2>
<table>
  <thead><tr><th>Role ID</th><th>Role Name</th><th>Description</th><th style="text-align:right"># of Staff Users</th></tr></thead>
  <tbody>${rolesRows || `<tr><td colspan="4">No roles returned</td></tr>`}</tbody>
</table>

<h2>Section 2 · Active Staff Users (${staff.length} of ${users.length} active users)</h2>
<table>
  <thead><tr><th>User ID</th><th>Name</th><th>Email</th><th>User Type</th><th>Role Name</th><th>Role ID</th><th>Last Login</th></tr></thead>
  <tbody>${staffRows || `<tr><td colspan="7">No staff users returned</td></tr>`}</tbody>
</table>

</body></html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    res.status(500).send(`<pre style="color:#b00;font:13px/1.4 monospace;padding:20px">Error: ${esc(err.message)}\n\n${esc(err.stack || "")}</pre>`);
  }
});

// ── Precompiled JSX bundle ───────────────────────────────────────────────────
// One ready-to-run JS file compiled server-side (see lib/bundle.js). Replaces
// shipping @babel/standalone + raw .jsx and compiling in the browser on every
// load. Cacheable via ETag so reloads are instant.
app.get("/app-bundle.js", (req, res) => {
  try {
    const { code, etag } = getBundle();
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache"); // revalidate via ETag, don't refetch body
    res.setHeader("ETag", etag);
    if (req.headers["if-none-match"] === etag) { res.status(304).end(); return; }
    res.send(code);
  } catch (err) {
    console.error("[bundle] serve error:", err.message);
    res.status(500).type("application/javascript").send(`console.error(${JSON.stringify("Bundle compile failed: " + err.message)});`);
  }
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

  // Precompile the frontend bundle so the first page load is already warm
  warmBundle();

  // Start the cron scheduler
  startScheduler();

  // Serve the last-known dashboard immediately so the first page load is
  // near-instant, then refresh from live sources in the background. Building
  // the dashboard makes hundreds of live API calls (~80s), so we never block
  // startup or the first request on it when we already have a prior snapshot.
  const haveSnapshot = loadPersistedDashboard(DEFAULT_PERIOD);

  (async () => {
    console.log(`[server] Starting initial sync in background${haveSnapshot ? " (serving cached snapshot meanwhile)" : ""}...`);
    try {
      await syncAll("full");
      await refreshDashboard(DEFAULT_PERIOD);
      console.log("[server] Initial sync and dashboard build complete");
    } catch (err) {
      console.error("[server] Initial sync failed:", err.message);
      // Try to build dashboard from whatever data is in DB
      try { await refreshDashboard(DEFAULT_PERIOD); } catch (e) { /* ignore */ }
    }
  })();
});
