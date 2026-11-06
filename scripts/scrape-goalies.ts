// Standalone script — run by the GitHub Actions workflow (not by the Next.js
// app itself), from an IP that isn't Vercel's, since dailyfaceoff.com's bot
// protection blocks requests from Vercel's shared range. Scrapes starting
// goalies for one date and writes the result to Redis, where the app reads
// it from.
//
// Usage: tsx scripts/scrape-goalies.ts [YYYY-MM-DD]
// With no argument, scrapes both today's and tomorrow's Eastern date (the
// app needs both — see Today/Tomorrow tabs). A single date argument scrapes
// just that date instead, for manual backfill.
// Requires REDIS_URL in the environment.
// Optionally calls APP_URL + "/api/goalies-updated" with SCRAPE_CALLBACK_SECRET
// afterward, to tell the app to pick up the new data immediately rather than
// waiting for its next scheduled refresh — skipped if either is unset.

import Redis from "ioredis";
import { fetchStartingGoalies } from "../lib/nhl/sources/dailyFaceoffGoalies";
import { getTodayEasternDate, getTomorrowEasternDate } from "../lib/nhl/easternDate";
import type { GoaliesRedisPayload } from "../lib/nhl/types";

// Starting goalies for a given date stop being useful once that date has
// passed — this just keeps the keyspace from accumulating forever.
const KEY_TTL_SECONDS = 3 * 24 * 60 * 60;

function redisKey(date: string): string {
  return `goalies:${date}`;
}

async function main() {
  const arg = process.argv[2];
  const dates = arg ? [arg] : [getTodayEasternDate(), getTomorrowEasternDate()];
  for (const date of dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Expected a YYYY-MM-DD date argument, got: "${date}"`);
    }
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is not set");
  }

  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
  redis.on("error", (err) => console.error("Redis connection error:", err.message));

  // Each date is independent — dailyfaceoff.com just not having tomorrow's
  // lines up yet is normal (fetchStartingGoalies returns [] for that, not an
  // error) and shouldn't stop today's write, or vice versa.
  const failures: string[] = [];
  try {
    for (const date of dates) {
      try {
        console.log(`Scraping starting goalies for ${date}...`);
        const matchups = await fetchStartingGoalies(date);
        console.log(`Fetched ${matchups.length} matchup(s) for ${date}`);

        const payload: GoaliesRedisPayload = {
          date,
          matchups,
          scrapedAt: new Date().toISOString(),
        };
        const serialized = JSON.stringify(payload);
        const key = redisKey(date);
        await redis.set(key, serialized, "EX", KEY_TTL_SECONDS);
        console.log(`Wrote ${key} (${serialized.length} bytes, expires in ${KEY_TTL_SECONDS}s)`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Failed to scrape ${date}:`, message);
        failures.push(`${date}: ${message}`);
      }
    }
  } finally {
    redis.disconnect();
  }

  if (failures.length === dates.length) {
    throw new Error(`All dates failed — ${failures.join("; ")}`);
  }

  await notifyApp();
}

async function notifyApp(): Promise<void> {
  const appUrl = process.env.APP_URL;
  const secret = process.env.SCRAPE_CALLBACK_SECRET;
  if (!appUrl || !secret) {
    console.log("APP_URL or SCRAPE_CALLBACK_SECRET not set — skipping app notify.");
    return;
  }

  const res = await fetch(new URL("/api/goalies-updated", appUrl), {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`App notify failed: ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`);
  }
  console.log("Notified app — snapshot refreshed.");
}

main().catch((err) => {
  console.error("scrape-goalies failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
