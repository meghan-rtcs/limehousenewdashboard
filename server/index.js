import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { buildDashboard } from "./lib/aggregator.js";
import { getCache, refresh, setRefresher, startBackgroundRefresh } from "./lib/cache.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_ROOT = path.join(__dirname, "..", "Limehouse Revamp");
const PORT = Number(process.env.PORT || 5000);

setRefresher(buildDashboard);

const app = express();

app.disable("etag");
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.get("/api/dashboard", async (req, res) => {
  const cache = getCache();
  if (!cache.payload) {
    res.status(503).json({
      error: "Data not yet loaded",
      fetching: cache.fetching,
      lastError: cache.lastError,
    });
    return;
  }
  res.json({
    ...cache.payload,
    sync: {
      fetchedAt: cache.fetchedAt,
      isStale: cache.isStale,
      lastError: cache.lastError,
    },
  });
});

app.post("/api/sync", async (req, res) => {
  const result = await refresh({ force: true });
  res.json({
    ok: !result.lastError,
    fetchedAt: result.fetchedAt,
    error: result.lastError,
  });
});

app.get("/api/sync-status", (req, res) => {
  const cache = getCache();
  res.json({
    fetchedAt: cache.fetchedAt,
    fetching: cache.fetching,
    isStale: cache.isStale,
    lastError: cache.lastError,
    lastErrorAt: cache.lastErrorAt,
    ttlMs: cache.ttlMs,
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(STATIC_ROOT, "Limehouse Dashboard - A.html"));
});

app.use(express.static(STATIC_ROOT, { etag: false, lastModified: false }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] listening on http://0.0.0.0:${PORT}`);
  console.log(`[server] static root: ${STATIC_ROOT}`);
  refresh({ force: true })
    .then((c) => {
      if (c.lastError) console.error(`[server] initial refresh error: ${c.lastError}`);
      else console.log(`[server] initial data loaded at ${new Date(c.fetchedAt).toISOString()}`);
    })
    .catch((e) => console.error("[server] initial refresh threw:", e));
  startBackgroundRefresh();
});
