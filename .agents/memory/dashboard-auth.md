---
name: Dashboard password protection
description: How the single-password login gate works and why it uses SameSite=None cookies
---

The whole dashboard is gated by a single shared password in env `DASHBOARD_PASSWORD` (a Replit secret). Implemented as a cookie-session login page in `server/index.js`, NOT HTTP Basic Auth.

**Why a cookie login, not Basic Auth:** the app is viewed through the Replit preview, which is a cross-site iframe. Browsers block native Basic Auth prompts inside cross-site iframes, and `SameSite=Lax` cookies are NOT sent on cross-site iframe requests. So the session cookie MUST be `SameSite=None; Secure` or login silently fails in the preview/iframe.

**Cookie scheme:** value = HMAC-SHA256("limehouse-session-v1", key=password) — never the password itself. Changing the password invalidates all existing sessions automatically. Compared with `crypto.timingSafeEqual`.

**Gate ordering (critical):** body parsers + `/login` + `/logout` routes are registered FIRST, then the auth-gate `app.use` middleware, then all data/api/static/debug routes. Anything registered after the gate is protected; anything before is public. The gate redirects HTML requests to `/login` and returns 401 JSON for `/api/*`.

**Fail-closed:** if `DASHBOARD_PASSWORD` is unset, `isAuthed()` returns false (deny everything) rather than exposing data.

**CSRF:** because the cookie is `SameSite=None`, mutating POST routes (`/api/sync`, `/api/sync-leadsimple`) require header `X-Requested-With: LimehouseDashboard`. A cross-origin attacker can't set custom headers without a CORS preflight the server never approves. The frontend Sync button (var-a.jsx) sends this header — if you add new mutating endpoints, add the same check and send the header from the client.

**Note:** cold-start runs a full Buildium sync; rapid repeated workflow restarts can trip Buildium 429 and crash startup. Wait ~60s between restarts.
