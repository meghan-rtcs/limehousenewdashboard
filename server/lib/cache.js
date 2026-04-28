const TTL_MS = 10 * 60 * 1000;

const state = {
  payload: null,
  fetchedAt: null,
  fetching: false,
  lastError: null,
  lastErrorAt: null,
};

let refresher = null;

export function getCache() {
  return {
    payload: state.payload,
    fetchedAt: state.fetchedAt,
    fetching: state.fetching,
    lastError: state.lastError,
    lastErrorAt: state.lastErrorAt,
    ttlMs: TTL_MS,
    isStale: state.fetchedAt ? Date.now() - state.fetchedAt > TTL_MS : true,
  };
}

export function setRefresher(fn) {
  refresher = fn;
}

export async function refresh({ force = false } = {}) {
  if (state.fetching) return getCache();
  if (!force && state.payload && Date.now() - state.fetchedAt < TTL_MS) {
    return getCache();
  }
  if (!refresher) throw new Error("No refresher registered");

  state.fetching = true;
  try {
    const payload = await refresher();
    state.payload = payload;
    state.fetchedAt = Date.now();
    state.lastError = null;
    state.lastErrorAt = null;
  } catch (err) {
    state.lastError = err.message || String(err);
    state.lastErrorAt = Date.now();
    console.error("[cache] refresh failed:", err);
  } finally {
    state.fetching = false;
  }
  return getCache();
}

export function startBackgroundRefresh(intervalMs = TTL_MS) {
  setInterval(() => {
    refresh({ force: true }).catch(() => {});
  }, intervalMs);
}
