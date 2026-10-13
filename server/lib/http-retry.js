// Small shared helpers for talking to rate-limited APIs (Buildium,
// RentEngine). Used by sync.js, where all live API calls now live.

// Retries a 429'd call with exponential backoff before giving up. Other
// errors (4xx/5xx that aren't rate limits) fail immediately — retrying those
// would just waste the backoff window on something that isn't transient.
// Shared between sync.js (where all live Buildium/RentEngine calls now live)
// and any other caller that needs the same backoff behavior.
export async function withRetry(fn, { retries = 2, baseDelayMs = 1500 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimited = /\b429\b/.test(err?.message || "");
      if (attempt >= retries || !isRateLimited) throw err;
      const delay = baseDelayMs * 2 ** attempt;
      console.warn(`[retry] 429, retrying in ${delay}ms (attempt ${attempt + 1}/${retries}): ${err.message}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// Runs an async mapper over items with a concurrency cap, to avoid firing
// 50+ requests in parallel and triggering 429s.
export async function pMap(items, concurrency, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
