const BASE = "https://api.buildium.com/v1";

function headers() {
  const id = process.env.BUILDIUM_CLIENT_ID;
  const secret = process.env.BUILDIUM_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("Missing BUILDIUM_CLIENT_ID / BUILDIUM_CLIENT_SECRET");
  }
  return {
    "x-buildium-client-id": id,
    "x-buildium-client-secret": secret,
    accept: "application/json",
  };
}

async function request(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
    else url.searchParams.append(k, String(v));
  }
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Buildium ${res.status} ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function listAll(path, params = {}, { pageSize = 1000, max = 5000 } = {}) {
  const out = [];
  let offset = 0;
  while (out.length < max) {
    const page = await request(path, { ...params, limit: pageSize, offset });
    if (!Array.isArray(page) || page.length === 0) break;
    out.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

export const buildium = {
  listUnits: () => listAll("/rentals/units"),
  listProperties: () => listAll("/rentals"),
  listOwners: () => listAll("/rentals/owners"),
  listLeases: (statuses = ["Active"]) => listAll("/leases", { statuses }, { pageSize: 1000, max: 50000 }),
  listAllLeases: () => listAll("/leases", { statuses: ["Active", "Past", "Future"] }, { pageSize: 1000, max: 50000 }),
  listOutstandingBalances: () => listAll("/leases/outstandingbalances"),
  listLeaseTransactions: (params) => listAll("/leases/transactions", params),
  listTenants: () => listAll("/leases/tenants"),
  listGLAccounts: () => listAll("/glaccounts", {}, { pageSize: 200, max: 1000 }),
  listGLTransactions: (params) => listAll("/generalledger/transactions", params, { pageSize: 1000, max: 100000 }),
  // Buildium requires the `esignaturestatuses` filter; "NotSent" + "Cancelled"
  // are the only enum values the account accepts and together cover every
  // renewal record regardless of e-sign workflow.
  listLeaseRenewals: () =>
    listAll(
      "/leases/renewals",
      { esignaturestatuses: ["NotSent", "Cancelled"] },
      { pageSize: 1000, max: 50000 }
    ),
  raw: request,
};
