import cron from "node-cron";
import { syncAll } from "./sync.js";

let syncing = false;

async function runSync(type = "incremental") {
  if (syncing) {
    console.log("[scheduler] Sync already in progress, skipping");
    return;
  }
  syncing = true;
  try {
    await syncAll(type);
  } catch (err) {
    console.error("[scheduler] Sync failed:", err.message);
  } finally {
    syncing = false;
  }
}

export function startScheduler() {
  // 6:00 AM ET (10:00 UTC) — morning sync
  cron.schedule("0 10 * * *", () => {
    console.log("[scheduler] Morning sync triggered");
    runSync("incremental");
  });

  // 9:00 PM ET (01:00 UTC next day) — evening sync
  cron.schedule("0 1 * * *", () => {
    console.log("[scheduler] Evening sync triggered");
    runSync("incremental");
  });

  // Midnight UTC — daily property roster snapshot for doors gained/lost tracking
  cron.schedule("5 0 * * *", () => {
    console.log("[scheduler] Midnight property snapshot sync triggered");
    runSync("incremental");
  });

  // Extra snapshots on rent collection windows:
  // Day 1-5 and Day 8-12 of each month at noon UTC
  // (captures "by 3rd" and "by 10th" windows)
  cron.schedule("0 16 1-5,8-12 * *", () => {
    console.log("[scheduler] Rent collection snapshot triggered");
    runSync("incremental");
  });

  console.log("[scheduler] Cron jobs registered (6 AM ET, 9 PM ET, rent-window snapshots)");
}

export { runSync };
